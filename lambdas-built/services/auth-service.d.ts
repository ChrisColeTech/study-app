import { User, AuthPayload } from '../types';
export declare class AuthService {
    private userRepository;
    private jwtSecret;
    constructor();
    register(email: string, password: string, name: string): Promise<{
        user: User;
        token: string;
    }>;
    login(email: string, password: string): Promise<{
        user: User;
        token: string;
    }>;
    verifyToken(token: string): Promise<AuthPayload>;
    getUserById(userId: string): Promise<User | null>;
    private generateToken;
    private getJWTSecret;
}
//# sourceMappingURL=auth-service.d.ts.map