export declare class MotorClient {
    private port;
    private token;
    constructor(port: number, token: string);
    private request;
    health(): Promise<boolean>;
    newSession(): Promise<string | null>;
    turn(message: string, sessionId: string): Promise<string | null>;
    sessions(): Promise<any[]>;
    close(): void;
}
//# sourceMappingURL=motor.d.ts.map