"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const joi_1 = __importDefault(require("joi"));
const auth_service_1 = require("../services/auth-service");
const response_builder_1 = require("../shared/response-builder");
const authService = new auth_service_1.AuthService();
// Validation schemas
const registerSchema = joi_1.default.object({
    email: joi_1.default.string().email().required(),
    password: joi_1.default.string().min(8).required(),
    name: joi_1.default.string().min(2).max(50).required(),
});
const loginSchema = joi_1.default.object({
    email: joi_1.default.string().email().required(),
    password: joi_1.default.string().required(),
});
const handler = async (event) => {
    try {
        const { httpMethod, resource, pathParameters } = event;
        // Handle OPTIONS request for CORS
        if (httpMethod === 'OPTIONS') {
            return response_builder_1.ResponseBuilder.success('', 200);
        }
        switch (`${httpMethod} ${resource}`) {
            case 'POST /api/v1/auth/register':
                return await handleRegister(event);
            case 'POST /api/v1/auth/login':
                return await handleLogin(event);
            case 'POST /api/v1/auth/refresh':
                return await handleRefresh(event);
            case 'POST /api/v1/auth/logout':
                return await handleLogout(event);
            default:
                return response_builder_1.ResponseBuilder.notFound('Route not found');
        }
    }
    catch (error) {
        console.error('Auth handler error:', error);
        return response_builder_1.ResponseBuilder.error(error instanceof Error ? error.message : 'Internal server error');
    }
};
exports.handler = handler;
async function handleRegister(event) {
    try {
        if (!event.body) {
            return response_builder_1.ResponseBuilder.validation('Request body is required');
        }
        const body = JSON.parse(event.body);
        const { error, value } = registerSchema.validate(body);
        if (error) {
            return response_builder_1.ResponseBuilder.validation(error.details[0].message);
        }
        const { email, password, name } = value;
        const result = await authService.register(email, password, name);
        return response_builder_1.ResponseBuilder.success(result);
    }
    catch (error) {
        if (error instanceof Error && error.message === 'User already exists') {
            return response_builder_1.ResponseBuilder.validation('User already exists');
        }
        throw error;
    }
}
async function handleLogin(event) {
    try {
        if (!event.body) {
            return response_builder_1.ResponseBuilder.validation('Request body is required');
        }
        const body = JSON.parse(event.body);
        const { error, value } = loginSchema.validate(body);
        if (error) {
            return response_builder_1.ResponseBuilder.validation(error.details[0].message);
        }
        const { email, password } = value;
        const result = await authService.login(email, password);
        return response_builder_1.ResponseBuilder.success(result);
    }
    catch (error) {
        if (error instanceof Error && error.message === 'Invalid credentials') {
            return response_builder_1.ResponseBuilder.unauthorized('Invalid credentials');
        }
        throw error;
    }
}
async function handleRefresh(event) {
    // For now, just return the current token validation
    // In a full implementation, you'd implement refresh token logic
    return response_builder_1.ResponseBuilder.success({ message: 'Token refresh not implemented yet' });
}
async function handleLogout(event) {
    // For JWT tokens, logout is typically handled client-side
    // In a full implementation, you might maintain a blacklist
    return response_builder_1.ResponseBuilder.success({ message: 'Logged out successfully' });
}
//# sourceMappingURL=auth-handler.js.map