import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateChannelDto, UpdateChannelDto, AuthChannelDto } from './dto/';
import { Channel, User, ChannelStatus, Role, Prisma } from '@prisma/client';
import * as argon from 'argon2';

@Injectable()
export class ChannelsService {
  constructor(private prisma: PrismaService) {}

  //retrieve all public channels
  async findAllChannels() {
    const publicChannels = await this.prisma.channel.findMany({
      where: { type: 'PUBLIC' || 'PROTECTED' },
    })
    if (publicChannels)
      console.log("YES");
    return publicChannels;
  }

  async findOneChannel(chanId: number, member: User) {
    const channel = await this.prisma.usersOnChannels.findUnique({ 
      where: { userId_channelId: {
        userId: member.id,
        channelId: chanId }
      }},
    )
    if (!channel)
      throw new NotFoundException(`User with id ${member.id} is not related to channel id ${chanId}`);
    return channel;
  }

  async createChannel(createChannelDto: CreateChannelDto, creator: User) {
    console.log("creator :", creator);
    const newChannel = await this.prisma.channel.create({
      data: {
        name: createChannelDto.name,
        avatar: createChannelDto.avatar,
        type: createChannelDto.type,
        members: { 
          create: [
            {
              role: 'OWNER',
              user: {connect: { id: creator.id }}
            }
          ]  
        },
      }
    })
    // setting password
    if (newChannel.type === ChannelStatus.PRIVATE || newChannel.type === ChannelStatus.PROTECTED )
    {
      await this.prisma.channel.update({ where: { id: newChannel.id },
        data: { password: await argon.hash(createChannelDto.password) } 
      })
    }
    console.log("new channel ", newChannel);
    return newChannel;
  }

  async findChannel(chanId: number) {
    const channel = await this.prisma.channel.findUnique({where: { id: chanId }},)
    if (!channel)
      throw new NotFoundException(`Channel id ${chanId} not found`);
    return channel;
  }

  async isInChannel(userId: number, chanId: number) {
    const inChannel = await this.prisma.usersOnChannels.findUnique({ where: {
      userId_channelId: { userId: userId, channelId: chanId} }});
    return inChannel;
  }

  async joinChannel(dto: AuthChannelDto, user: User) {
    try {
      const chan = await this.findChannel(dto.id);
      
      if (await this.isInChannel(user.id, chan.id))
        throw new NotFoundException(`User ${user.id} is already in channel ${chan.id}`);

      if (chan.password) {
        const pwdMatch = await argon.verify(chan.password, dto.password);
			if (!pwdMatch)
				throw new ForbiddenException('incorrect password');
      }

      const joinChannel = await this.prisma.channel.update({ where: { id: chan.id}, 
        data: {
          members: {
            connect: [{ userId_channelId: { userId: user.id, channelId: chan.id }}],
            create: [{ userId: user.id, role: Role.USER }]
          }
        }})
      return joinChannel;

    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError)
        return { error: 'An error occurred while addind other user in channel' };
      throw error;
    }
  }

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
      
        if (userInchannel.role ===  Role.USER || !userInchannel.role)
          throw new ForbiddenException(`User ${member.id} has not required role for this action`);
      
        const addInChannel = await this.prisma.channel.update({ where: { id: chanId}, 
        data: {
          members: {
            connect: [{ userId_channelId: { userId: friendId, channelId: chanId }}],
            create: [{ userId: friendId, role: Role.USER }]
          }
        }})
        return addInChannel;
    } catch (error) { 
      if (error instanceof Prisma.PrismaClientKnownRequestError)
				return { error: 'An error occurred while addind other user in channel' };
			throw error;
    }   
  }

  async updateChannel(dto: UpdateChannelDto, user: User) {
    try {
      const chan = await this.findChannel(dto.id);
      
      const inChan = await this.isInChannel(user.id, chan.id)
      if (!inChan)
        throw new NotFoundException(`User ${user.id} is not in channel ${chan.id}`);

      if (chan.password) {
        const pwdMatch = await argon.verify(chan.password, dto.password);
			if (!pwdMatch)
				throw new ForbiddenException('incorrect password');
      }

      if (inChan.role === Role.USER || !inChan.role)
        throw new ForbiddenException(`User ${user.id} has not required role for this action`);
      
        const updateChannel = await this.prisma.channel.update({ where: { id: chan.id}, 
        data: {
          name: dto.name,
	        type: dto.type,
	        password:	dto.password,
        }})
      return updateChannel;

    } catch (error) { }    
  }

  remove(id: number) {
    return `This action removes a #${id} channel`;
  }

  /****************************** CRUD USER ON CHANNEL ***********************/



  // ROLE USER : BLOCK, INVITE_PONG, GET_PROFILE, LEAVE, SEND_MESSAGE

  // ROLE ADMIN : BLOCK, LEAVE, KICK, BAN, MUTE /!\ if target is not owner

  // ROLE OWNER : SET_PASSWORD, SET_ADMINS


}
