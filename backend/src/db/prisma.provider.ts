import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaProvider extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PrismaProvider.name);
    private maxRetries = 3;
    private retryDelay = 1500; // 1.5 segundos

    async onModuleInit() {
        try {
            await this.$connect();
            this.logger.log('Prisma connected');
        } catch (error) {
            this.logger.error('Error connecting to Prisma:', error);
            await this.handleConnectionError();
        }
    }

    async onModuleDestroy() {
        await this.$disconnect();
        this.logger.log('Prisma disconnected');
    }

    async handleConnectionError(retryCount = 0) {
        if (retryCount < this.maxRetries) {
            this.logger.log(`Retrying Prisma connection in ${this.retryDelay / 1000} seconds... (Attempt ${retryCount + 1}/${this.maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, this.retryDelay));
            try {
                await this.$connect();
                this.logger.log('Prisma reconnected successfully.');
            } catch (retryError) {
                this.logger.error('Retry failed:', retryError);
                await this.handleConnectionError(retryCount + 1);
            }
        } else {
            this.logger.error('[ERROR]Max retries reached. Prisma connection failed.');
            throw new Error('Failed to connect to Prisma after multiple retries.');
        }
    }
    
    async findManyWithRetry<T>(model: keyof PrismaClient, args: any): Promise<T[]> {
        let retries = 0;
        while (retries < this.maxRetries) {
            try {
                // @ts-ignore
                return await this[model].findMany(args);
            } catch (error) {
                if (error.code === 'P1001') { // Erro de conexão
                    this.logger.warn(`Connection error during findMany. Retrying... (Attempt ${retries + 1}/${this.maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                    retries++;
                } else {
                    this.logger.error('Error during findMany:', error);
                    throw error; 
                }
            }
        }
        throw new Error('Failed to execute findMany after multiple retries.');
    }

    async findUniqueWithRetry<T>(model: keyof PrismaClient, args: any): Promise<T | null> {
        let retries = 0;
        while (retries < this.maxRetries) {
            try {
                // @ts-ignore
                return await this[model].findUnique(args);
            } catch (error) {
                if (error.code === 'P1001') {
                    this.logger.warn(`Connection error during findUnique. Retrying... (Attempt ${retries + 1}/${this.maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                    retries++;
                } else {
                    this.logger.error('Error during findUnique:', error);
                    throw error;
                }
            }
        }
        throw new Error('Failed to execute findUnique after multiple retries.');
    }

}