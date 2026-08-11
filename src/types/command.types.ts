import { WASocket, proto } from '@whiskeysockets/baileys';

export interface CommandContext {
  sock: WASocket;
  rawMessage: proto.IWebMessageInfo;
  chatId: string;
  senderJid: string;
  commandName: string;
  args: string[];
  startTime: number;
}

export type CommandHandlerFunction = (ctx: CommandContext) => Promise<void>;

export interface CommandDefinition {
  name: string;
  description: string;
  execute: CommandHandlerFunction;
}
