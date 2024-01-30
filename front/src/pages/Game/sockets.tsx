import {
	Dispatch,
	SetStateAction
} from "react"
import axios, { AxiosResponse } from "axios"

import {
	findUserInChannel,
	removeUserInChannel,
	setUserToAdministrator,
	setUserToBanned,
	setUserToMember,
	setUserToOwner,
	updateUserInChannel,
	userIsFriend,
	userIsInChannel
} from "../../utils/functions"

import {
	challengeStatus,
	channelRole,
	messageStatus,
	userStatus
} from "../../utils/status"

import {
	Channel,
	ChannelDatas,
	Message,
	MessageInvitation,
	MessageText,
	User,
	UserAuthenticate
} from "../../utils/types"

// Fonctions appellées uniquement lors d'emits de socekts. Ces fonctions servent à mettre à jour des données en temps réel chez l'ensemble des utilisateurs 

type PropsUpdateDiscussion = {
	idSend: number,
	idChannel: number,
	idTargetOrMsg: number | string,

	channelTarget: Channel | undefined,
	setChannelTarget: Dispatch<SetStateAction<Channel | undefined>>,
}

export function updateDiscussion(props: PropsUpdateDiscussion) {
	
	if (props.channelTarget?.id === props.idChannel)
	{
		// console.log("here");

		let messageContent: Message;
		const userSend = findUserInChannel(props.channelTarget, props.idSend);
		if (!userSend)
			throw new Error
		console.log("USERSEND = ", userSend)
		if (typeof props.idTargetOrMsg === 'number')
		{

			const userTarget = findUserInChannel(props.channelTarget , props.idTargetOrMsg);
			if (!userTarget)
			throw new Error
			messageContent = {
				sender: userSend,
				type: messageStatus.INVITATION,
				target: userTarget,
				status: challengeStatus.PENDING
			} as MessageInvitation
		
		}
		else {
			messageContent ={
				sender: userSend,
				type: messageStatus.TEXT,
				content: props.idTargetOrMsg
			} as MessageText
		}
		if (props.idChannel === props.channelTarget.id)
		{
			props.setChannelTarget((prevState: Channel | undefined) => {
			if (prevState)
			{
				return {
					...prevState,
					messages: [
						...prevState.messages,
						messageContent
					]
				}
			}
			else
				return (undefined)
			});
		};
	}
};



type PropsRefreshJoinChannel = {
	channelId: number,
	userId: number,

	userAuthenticate: UserAuthenticate,
	setUserAuthenticate: Dispatch<SetStateAction<UserAuthenticate>>,
	channelTarget: Channel | undefined,
	setChannelTarget: Dispatch<SetStateAction<Channel | undefined>>,

	token: string,
	url: string

}

export async function refreshJoinChannel(props: PropsRefreshJoinChannel) {


	console.log("JOIN PROPS", props)


	// Valide si le user auth est invité dans le channel
	if (props.userId === props.userAuthenticate.id)
	{
		// Récupère les données du channel dans lequel il a été ajouté
		const newChannelResponse: AxiosResponse<ChannelDatas> = await axios.get(`http://${props.url}:3333/channel/${props.channelId}`, {
			headers: {
				'Authorization': `Bearer ${props.token}`
			}
		})
		
		const newChannel: Channel = {
			...newChannelResponse.data,
			messages: [],
			members: [],
			administrators: [],
			owner: undefined,
			mutedUsers: [],
			banneds: []
		}

		props.setUserAuthenticate((prevState: UserAuthenticate) => ({
			...prevState,
			channels: [ ...prevState.channels, newChannel ]
		}))
	}

	// Valide si le user auth déjà présent dans le channel a la fenêtre de chat ouverte
	else if (props.channelTarget?.id === props.channelId)
	{
		const userResponse: AxiosResponse<User> = await axios.get(`http://${props.url}:3333/user/${props.userId}`, {
			headers: {
				'Authorization': `Bearer ${props.token}`
			}
		})

		props.setChannelTarget((prevState: Channel | undefined) => {
			if (prevState)
			{
				return {
					...prevState,
					members: [
						...prevState.members,
						userResponse.data
					]
				}
			}
			else
				return (undefined)
		})
	}
}


type PropsRefreshLeaveChannel = {
	channelId: number,
	userId: number,

	userAuthenticate: UserAuthenticate,
	setUserAuthenticate: Dispatch<SetStateAction<UserAuthenticate>>,
	channelTarget: Channel | undefined,
	setChannelTarget: Dispatch<SetStateAction<Channel | undefined>>,
}


export async function refreshLeaveChannel(props: PropsRefreshLeaveChannel) {

	if (props.userId === props.userAuthenticate.id)
	{
		props.setUserAuthenticate((prevState: UserAuthenticate) => {
			return {
				...prevState,
				channels: prevState.channels.filter((channel) => channel.id !== props.channelId)
			}
		})
		if (props.channelTarget?.id === props.channelId)
			props.setChannelTarget(undefined)
	}
	else if (props.channelTarget?.id === props.channelId)
	{
		props.setChannelTarget((prevState: Channel | undefined) => {
			if (prevState)
			{
				return {
					...prevState,
					members: prevState.members.filter((member) => member.id !== props.userId),
					administrators: prevState.administrators.filter((administrator) => administrator.id !== props.userId),
					owner: prevState.owner?.id === props.userId ? undefined : prevState.owner
				}
			}
			else
				return (undefined)
		})	
	}
}

type PropsRefreshUserRole = {
	channelId: number,
	userId: number,
	newRole: any,

	userAuthenticate: UserAuthenticate,
	setUserAuthenticate: Dispatch<SetStateAction<UserAuthenticate>>,
	channelTarget: Channel | undefined,
	setChannelTarget: Dispatch<SetStateAction<Channel | undefined>>
}

export async function refreshUserRole(props : PropsRefreshUserRole) {
	try {
		if (props.newRole === channelRole.BANNED && props.userAuthenticate.id === props.userId)
		{
			await refreshLeaveChannel({
				channelId: props.channelId,
				userId: props.userId,
				userAuthenticate: props.userAuthenticate,
				setUserAuthenticate: props.setUserAuthenticate,
				channelTarget: props.channelTarget,
				setChannelTarget: props.setChannelTarget
			})
		}
		else if (props.channelTarget?.id === props.channelId)
		{
			const setChannel = props.setChannelTarget as Dispatch<SetStateAction<Channel>> 

			if (props.newRole === channelRole.UNBANNED) {
				setChannel((prevState: Channel) => {
					return (removeUserInChannel(prevState, props.userId))
				})
			}
			else
			{
				const userTarget = findUserInChannel(props.channelTarget, props.userId)
				if (!userTarget)
					throw new Error

				if (props.newRole === channelRole.MEMBER) {
					setChannel((prevState: Channel) => {
						return (setUserToMember(prevState, userTarget))
					})
				}
				else if (props.newRole === channelRole.ADMIN) {	
					setChannel((prevState: Channel) => {
						return (setUserToAdministrator(prevState, userTarget))
					})
				}
				else if (props.newRole === channelRole.BANNED) {	
					setChannel((prevState: Channel) => {
						return (setUserToBanned(prevState, userTarget))
					})
				}
			}
		}
	}
	catch (error) {
		console.log(error)
	}

}

type PropsRefreshNewOwner = {
	channelId: number,
	userId: number,

	userAuthenticate: UserAuthenticate,
	setUserAuthenticate: Dispatch<SetStateAction<UserAuthenticate>>,
	channelTarget: Channel | undefined,
	setChannelTarget: Dispatch<SetStateAction<Channel | undefined>>,
}

export async function refreshNewOwner(props: PropsRefreshNewOwner) {
	if (props.userId === props.userAuthenticate.id)
	{
		props.setUserAuthenticate((prevState: UserAuthenticate) => {
			return {
				...prevState,
				channels: prevState.channels.map((channel: Channel) => {
					if (channel.id === props.channelId)
						return (setUserToOwner(channel, prevState))
					else
						return (channel)
				})
			}
		})
	}
	if (props.channelTarget?.id === props.channelId)
	{
		const userTarget = findUserInChannel(props.channelTarget, props.userId)
		if (!userTarget)
			throw new Error
		props.setChannelTarget((prevState: Channel | undefined) => {
			if (prevState)
				return (setUserToOwner(prevState, userTarget))
			else
				return (undefined)
		})	
	}
}



type PropsRefreshUserStatus = {
	userId: number,
	newStatus: userStatus,

	userAuthenticate: UserAuthenticate,
	setUserAuthenticate: Dispatch<SetStateAction<UserAuthenticate>>,
	channelTarget: Channel | undefined,
	setChannelTarget: Dispatch<SetStateAction<Channel | undefined>>,
}

// Met à jour le statut d'un user
export function refreshUserStatus(props: PropsRefreshUserStatus) {

	if (props.userId === props.userAuthenticate.id) {
		props.setUserAuthenticate((prevState: UserAuthenticate) => {
			return {
				...prevState,
				status: props.newStatus
			}
		})
	}
	else if (userIsFriend(props.userAuthenticate, props.userId)) {
		props.setUserAuthenticate((prevState: UserAuthenticate) => {
			return {
				...prevState,
				friends: prevState.friends.map((friend) => {
					if (friend.id === props.userId) {
						return {
							...friend,
							status: props.newStatus
						}
					}
					else
						return (friend)
				})
			}
		})

		if (props.channelTarget && userIsInChannel(props.channelTarget, props.userId)) {
			props.setChannelTarget((prevState: Channel | undefined) => {
				if (prevState)
					return updateUserInChannel(prevState, props.userId, props.newStatus)
			})
		}
	}
}

type PropsRefreshUpdateChannel = {
	channelId: number,
	newDatas: any,

	setUserAuthenticate: Dispatch<SetStateAction<UserAuthenticate>>,
	channelTarget: Channel | undefined,
	setChannelTarget: Dispatch<SetStateAction<Channel | undefined>>
}

// Met à jour les données d'un channel
export function refreshUpdateChannel(props: PropsRefreshUpdateChannel) {
	if (props.channelTarget?.id === props.channelId)
	{
		props.setChannelTarget((prevState: Channel | undefined) => {
			if (prevState) {
				return {
					...prevState,
					...props.newDatas
				}
			}
			else
				return (undefined)

		});
	}

	props.setUserAuthenticate((prevState) => ({
		...prevState,
		channels: prevState.channels.map((channel) => {
			if (channel.id === props.channelId) {
				return {
					...channel,
					...props.newDatas
				}
			}
			else
				return channel
		})
	}))
}

type PropsRefreshDeleteChannel = {
	channelId: number,

	setUserAuthenticate: Dispatch<SetStateAction<UserAuthenticate>>,
	channelTarget: Channel | undefined,
	setChannelTarget: Dispatch<SetStateAction<Channel | undefined>>
}

// Supprime un channel
export function refreshDeleteChannel(props: PropsRefreshDeleteChannel) {
	props.setUserAuthenticate((prevState) => ({
		...prevState,
		channels: prevState.channels.filter((channel) => channel.id !== props.channelId)
	}))

	if (props.channelTarget && props.channelTarget.id === props.channelId)
		props.setChannelTarget(undefined)
}

type PropsRecieveChannelMP = {
	channelId: number,
	recipientId: number,

	token: string,
	url: string,
	userAuthenticate: UserAuthenticate,
	setUserAuthenticate: Dispatch<SetStateAction<UserAuthenticate>>,
	setChannelTarget: Dispatch<SetStateAction<Channel | undefined>>,
	displayChat: Dispatch<SetStateAction<boolean>>,
}

// Crée un channel MP
export async function recieveChannelMP(props: PropsRecieveChannelMP) {

	const channelMPResponse: AxiosResponse<Channel> = await axios.get(`http://${props.url}:3333/channel/${props.channelId}/relations`, {
		headers: {
			'Authorization': `Bearer ${props.token}`
		}
	})

	props.setUserAuthenticate((prevState) => ({
		...prevState,
		channels: [
			...prevState.channels,
			channelMPResponse.data
		]
	}))

	if (props.userAuthenticate.id !== props.recipientId)
	{
		props.setChannelTarget(channelMPResponse.data)
		props.displayChat(true)
	}
}