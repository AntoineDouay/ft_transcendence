import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UseGuards } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateChannelDto, UpdateChannelDto, AuthChannelDto } from './dto/';
import { Channel, User, ChannelStatus, Role, Prisma } from '@prisma/client';
import * as argon from 'argon2';
import { JwtGuard } from 'src/auth/guards/auth.guard';

@UseGuards(JwtGuard)
@Injectable()
export class ChannelsService {
  constructor(private prisma: PrismaService) {}

  // Cree un channel
  async createChannel(createChannelDto: CreateChannelDto, creatorId: number) {
    const newChannel = await this.prisma.channel.create({
      data: {
        name: createChannelDto.name,
        avatar: createChannelDto.avatar,
        type: createChannelDto.type,
        users: { 
          create: [
            {
              role: 'OWNER',
              user: {connect: { id: creatorId }}
            }
          ]  
        },
      }
    })
    // setting password
    if (newChannel.type === ChannelStatus.PROTECTED)
    {
      await this.prisma.channel.update({ where: { id: newChannel.id },
        data: { password: await argon.hash(createChannelDto.password) } 
      })
    }

    console.log(`Channel ${newChannel.id} was created`)
    return newChannel;
  }

  // Cree un channel MP
  async createChannelMP(recipientId: number, creatorId: number, channelDatas: CreateChannelDto) {

    const channelMPAlreadyExist = await this.findChannelMP(recipientId, creatorId)
    if (channelMPAlreadyExist)
     throw new BadRequestException('MP canal already exist')

    const newChannelMP = await this.createChannel(channelDatas, creatorId)

    await this.joinChannel(newChannelMP, recipientId)

    return newChannelMP;
  }

  // Ajoute un user dans un channel
  async joinChannel(joinChannelDatas: AuthChannelDto, userId: number) {
    try {
      const channelToJoin = await this.findChannel(joinChannelDatas.id);
      
      const inChan = await this.isInChannel(userId, channelToJoin.id);
      if (inChan)
        throw new BadRequestException(`User ${userId} is already in channel ${channelToJoin.id}`);

      if (channelToJoin.password) {
        const pwdMatch = await argon.verify(channelToJoin.password, joinChannelDatas.password);
			if (!pwdMatch)
				throw new ForbiddenException('Incorrect password');
      }

      const joinChannel = await this.prisma.channel.update({ where: { id: channelToJoin.id}, 
        data: {
          users: { 
            create: [
              {
                role: 'MEMBER',
                user: {connect: { id: userId }}
              }
            ]  
          }
        }})

      console.log(`User ${userId} joined channel ${joinChannelDatas.id}`)

      return joinChannel;

    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError)
        return { error: 'An error occurred while addind other user in channel' };
      throw error;
    }
  }

  // Retourne tout les channels
  async findAllChannels() {
    const channels = await this.prisma.channel.findMany()

    // console.log("Channels :", channels)
    return channels;
  }

  // Retourne tout les channels PUBLIC et PROTECTED
  async findAllChannelsAccessibles() {
    const accessibleChannels = await this.prisma.channel.findMany({
      where: { type: {
        in: ['PUBLIC', 'PROTECTED']
      }
    },
    })

    // console.log("Accessibles channels :", accessibleChannels)
    return accessibleChannels;
  }

  // Retourne un channel
  async findChannel(chanId: number) {
    const channel = await this.prisma.channel.findUnique({where: { id: chanId }},)
    if (!channel)
      throw new NotFoundException(`Channel id ${chanId} not found`);

    // console.log(`Channel ${chanId} :`, channel)
    return channel;
  }

  // Retourne un channel avec ses relations
  async findChannelWithRelations(chanId: number) {
    const channelDatas = await this.prisma.channel.findUnique({ 
      where: { 
        id: chanId
      },
      include: {
        users: {
          select: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
                status: true,
                wins: true,
                draws: true,
                losses : true     
              }
            },
            role: true
          }
        }
      }
    })
    if (!channelDatas)
      throw new NotFoundException(`Channel ${chanId} not found`);

    const { users, ...rest } = channelDatas
    const channelWithRelations = {
      ...rest,
      messages: [], // en attendant de pouvoir recup les messages
      members: channelDatas.users.map((member) => {
        if (member.role === "MEMBER")
          return (member.user)
      }).filter(Boolean),
      administrators: channelDatas.users.map((member) => {
        if (member.role === "ADMIN")
          return (member.user)
      }).filter(Boolean),
      owner: channelDatas.users.find((member) => member.role === "OWNER").user,
      mutedUsers: [], // en attendant de pouvoir recup les users mutes
      bannedUsers: [] // en attendant de pouvoir recup les users bans
    }

    // console.log(`Channel ${chanId} with relations :`, channelWithRelations)
    return channelWithRelations;
  }

  // Modifie un channel
  async updateChannel(channelId: number, newChannelDatas: UpdateChannelDto, userId: number) {
    try {
      const channelToUpdate = await this.findChannel(channelId);
      const inChan = await this.isInChannel(userId, channelToUpdate.id)
      if (!inChan)
        throw new NotFoundException(`User ${userId} is not in channel ${channelToUpdate.id}`);
      if (channelToUpdate.password) {
        const pwdMatch = await argon.verify(channelToUpdate.password, newChannelDatas.password);
			if (!pwdMatch)
				throw new ForbiddenException('Incorrect password');
      }
      if (inChan.role !== Role.OWNER || !inChan.role)
        throw new ForbiddenException(`User ${userId} has not required role for this action`);
      
        const updateChannel = await this.prisma.channel.update({ where: { id: channelToUpdate.id}, 
        data: {
          name: newChannelDatas.name,
	        type: newChannelDatas.type,
	        password:	newChannelDatas.password,
          avatar: newChannelDatas.avatar
        }})

      console.log(`Channel ${channelId} has been updated`)
      return updateChannel;

    } catch (error) { }    
  }

  // Supprime un channel
  async remove(channelId: number) {
  
    // Supprime les relations user - channel
    await this.prisma.usersOnChannels.deleteMany({
      where: {
        channelId: channelId
      }
    })

    // Supprime les relations message - channel
    await this.prisma.message.deleteMany({
      where: {
        channelId: channelId
      }
    })

    // Supprime le channel
		const deleteChannel = await this.prisma.channel.delete({
      where: {
        id: channelId
      }
    });

    console.log(`Channel ${channelId} has been deleted`)
		return deleteChannel;
	}

  // Retire un user d'un channel
  // Si le user etait owner, set un nouvel owner
  // Si le user etait le dernier, supprime le channel
  async leaveChannel(userId: number, channelId: number) {

    const userLeave = await this.prisma.usersOnChannels.delete({
      where: {
        userId_channelId: {
          userId: userId,
          channelId: channelId
        }
      }
    })

    const numberOfMembers: number = await this.countMembersInChannel(channelId)

    console.log(`User ${userId} left channel ${channelId}`)
  
    // Supprime le channel
    if (numberOfMembers === 0)
    {
      const removeChannel = await this.remove(channelId)
      return ([ userLeave, removeChannel ])
    }
    // Set un nouvel owner
    else if (userLeave.role === "OWNER")
    {
      const newOwner = await this.setNewOwner(channelId)
      return ([ userLeave, newOwner ])
    }

    return (userLeave)
  }

    /****************************** gestion message ***********************/

    async addContent(id: number, msg:string, user :User) {


      const newMessage = await this.prisma.message.create({
        data: {
          author: { connect: { id: user.id } },  // Connectez le message à l'utilisateur existant
          channel: { connect: { id: id } }, 
          content: msg,
          isInvit: true
        },
      });
      //console.log(newMessage.content);
    }
  
    async getAllMessage(id: number) {
      try {
        const channel = await this.prisma.channel.findUnique({
          where: { id: id },
          include: { content: true },
        });
    
        if (!channel) {
          console.error("Le canal n'existe pas.");
          return;
        }
    
        const messages = channel.content;
    
        if (!messages) {
          console.error("Aucun message trouvé dans le canal.");
          return;
        }
        for (const message of messages) {
          console.log(message.authorId, " = ",message.content);
          //retourner les messages 
        }
      } catch (error) {
        console.error("Une erreur s'est produite lors de la récupération des messages.", error);
      }
    }

    async getAllUserId(id: number)
    {
      const usersOnChannels = await this.prisma.usersOnChannels.findMany({
        where: {
          channelId: id,
        },
        select: {
          userId: true,
        },
      });
      const userIds = usersOnChannels.map((userOnChannel) => userOnChannel.userId);
      return userIds;
    }


/* =============================== UTILS ==================================== */

    // cherche un channel de type MP qui contient les 2 users
    async findChannelMP(recipientId: number, creatorId: number) {

    const channel = await this.prisma.channel.findFirst({
      where: {
        type: ChannelStatus.MP,
        users: {
          every: {
            OR: [
              {
                user: {
                  id: recipientId
                }
              },
              {
                user: {
                  id: creatorId
                }
              }
            ]
          }
        }
      }
    })
    return channel;
  }
  
  async isInChannel(userId: number, chanId: number) {
    
    const inChannel = await this.prisma.usersOnChannels.findUnique({
      where: {
       userId_channelId: {
        userId: userId,
        channelId: chanId
      }
    }});

  return inChannel;
}

async countMembersInChannel(chanId: number): Promise<number> {

  const result = (await this.prisma.channel.findUnique({
    where: {
      id: chanId
    },
    include: {
      users: true
    }
  })).users.length

  return (result)
}

async setNewOwner(channelId: number) {
  
  const administratorFound = await this.prisma.usersOnChannels.findFirst({
    where: {
      channelId: channelId,
      role: "ADMIN"
    },
    select: {
      userId: true,
      role: true
    }
  })
  const memberFound = await this.prisma.usersOnChannels.findFirst({
    where: {
      channelId: channelId,
      role: "MEMBER"
    },
    select: {
      userId: true,
      role: true
    }
  })

  const newOwner = administratorFound ? administratorFound : memberFound

  await this.prisma.usersOnChannels.update({
    where: {
      userId_channelId: {
        userId: newOwner.userId,
        channelId: channelId
      }
    },
    data: {
      role: "OWNER"
    },
    select: {
      userId: true,
      role: true
    }
  })

  console.log(`User ${newOwner.userId} is the new owner of channel ${channelId}`)
}

/* =========================== PAS UTILISEES ================================ */

async addUserInChannel(friendId: number, member: User, chanId: number) {
  if (friendId === member.id)
    return { error: 'Cannot add your self in channel'}

  try {
    this.findChannel(chanId);
    
    if (await this.isInChannel(friendId, chanId))
      throw new NotFoundException(`User ${friendId} is already in channel ${chanId}`);

    const userInchannel = await this.isInChannel(member.id, chanId);
    if (!userInchannel)
      throw new NotFoundException(`User id ${member.id} is not in channel id ${chanId}`);
    
      if (userInchannel.role ===  Role.MEMBER || !userInchannel.role)
        throw new ForbiddenException(`User ${member.id} has not required role for this action`);
    
      const addInChannel = await this.prisma.channel.update({ where: { id: chanId}, 
      data: {
        users: {
          connect: [{ userId_channelId: { userId: friendId, channelId: chanId }}],
          create: [{ userId: friendId, role: Role.MEMBER }]
        }
      }})
      return addInChannel;
  } catch (error) { 
    if (error instanceof Prisma.PrismaClientKnownRequestError)
      return { error: 'An error occurred while addind other user in channel' };
    throw error;
  }   
}




  /****************************** CRUD USER ON CHANNEL ***********************/



  // ROLE USER : BLOCK, INVITE_PONG, GET_PROFILE, LEAVE, SEND_MESSAGE

  // ROLE ADMIN : BLOCK, LEAVE, KICK, BAN, MUTE /!\ if target is not owner

  // ROLE OWNER : SET_PASSWORD, SET_ADMINS


}
