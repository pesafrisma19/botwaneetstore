import { CommandDefinition, CommandHandlerFunction } from '../types/command.types';
import { pingCommand } from '../commands/ping.command';

class CommandRegistry {
  private commands = new Map<string, CommandDefinition>();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    this.register({
      name: 'ping',
      description: 'Cek status dan performa bot real-time',
      execute: pingCommand,
    });
  }

  public register(command: CommandDefinition): void {
    const key = command.name.toLowerCase().trim();
    this.commands.set(key, command);
  }

  public getCommand(name: string): CommandDefinition | undefined {
    const key = name.toLowerCase().trim();
    return this.commands.get(key);
  }

  public hasCommand(name: string): boolean {
    const key = name.toLowerCase().trim();
    return this.commands.has(key);
  }
}

export const commandRegistry = new CommandRegistry();
