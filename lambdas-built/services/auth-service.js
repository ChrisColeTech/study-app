"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const client_secrets_manager_1 = require("@aws-sdk/client-secrets-manager");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const uuid_1 = require("uuid");
const aws_clients_1 = __importDefault(require("../shared/aws-clients"));
const user_repository_1 = __importDefault(require("../repositories/user-repository"));
class AuthService {
    constructor() {
        this.jwtSecret = null;
        this.userRepository = new user_repository_1.default();
    }
    async register(email, password, name) {
        // Check if user already exists
        const existingUser = await this.userRepository.findByEmail(email);
        if (existingUser) {
            throw new Error('User already exists');
        }
        // Hash password
        const passwordHash = await bcrypt_1.default.hash(password, 10);
        // Create user
        const user = {
            userId: (0, uuid_1.v4)(),
            email,
            name,
            passwordHash,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        await this.userRepository.create(user);
        // Generate token
        const token = await this.generateToken(user);
        // Remove password from response
        const { passwordHash: _, ...userResponse } = user;
        return { user: userResponse, token };
    }
    async login(email, password) {
        const user = await this.userRepository.findByEmail(email);
        if (!user || !user.passwordHash) {
            throw new Error('Invalid credentials');
        }
        const isValidPassword = await bcrypt_1.default.compare(password, user.passwordHash);
        if (!isValidPassword) {
            throw new Error('Invalid credentials');
        }
        const token = await this.generateToken(user);
        // Remove password from response
        const { passwordHash: _, ...userResponse } = user;
        return { user: userResponse, token };
    }
    async verifyToken(token) {
        const secret = await this.getJWTSecret();
        return jsonwebtoken_1.default.verify(token, secret);
    }
    async getUserById(userId) {
        const user = await this.userRepository.findById(userId);
        if (user && user.passwordHash) {
            const { passwordHash: _, ...userResponse } = user;
            return userResponse;
        }
        return user;
    }
    async generateToken(user) {
        const secret = await this.getJWTSecret();
        const payload = {
            userId: user.userId,
            email: user.email,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
        };
        return jsonwebtoken_1.default.sign(payload, secret);
    }
    async getJWTSecret() {
        if (this.jwtSecret) {
            return this.jwtSecret;
        }
        const secretName = process.env.JWT_SECRET_NAME;
        if (!secretName) {
            throw new Error('JWT_SECRET_NAME environment variable not set');
        }
        try {
            const client = aws_clients_1.default.getSecretsClient();
            const response = await client.send(new client_secrets_manager_1.GetSecretValueCommand({
                SecretId: secretName,
            }));
            if (response.SecretString) {
                const secret = JSON.parse(response.SecretString);
                this.jwtSecret = secret.jwt_secret;
                return this.jwtSecret;
            }
            throw new Error('JWT secret not found');
        }
        catch (error) {
            console.error('Error retrieving JWT secret:', error);
            throw new Error('Failed to retrieve JWT secret');
        }
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=auth-service.js.map