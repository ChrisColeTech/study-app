"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const provider_service_1 = require("../services/provider-service");
const response_builder_1 = require("../shared/response-builder");
const auth_middleware_1 = require("../shared/auth-middleware");
const providerService = new provider_service_1.ProviderService();
// Core provider handler - now focused only on business logic
const providerHandler = async (event, userId) => {
    const { route } = (0, auth_middleware_1.extractRequestInfo)(event);
    console.log(`[PROVIDER] Handling ${route} for user ${userId}`);
    switch (route) {
        case 'GET /api/v1/providers':
            return await handleGetProviders(event, userId);
        case 'GET /api/v1/providers/{providerId}':
            return await handleGetProvider(event, userId);
        case 'GET /api/v1/providers/{providerId}/exams':
            return await handleGetProviderExams(event, userId);
        default:
            return response_builder_1.ResponseBuilder.notFound('Route not found');
    }
};
// Export the handler wrapped with authentication middleware
exports.handler = (0, auth_middleware_1.withAuth)(providerHandler);
async function handleGetProviders(event, userId) {
    console.log(`[PROVIDER] Getting all providers for user ${userId}`);
    const result = await providerService.getProviders();
    return response_builder_1.ResponseBuilder.success(result);
}
async function handleGetProvider(event, userId) {
    const { pathParameters } = (0, auth_middleware_1.extractRequestInfo)(event);
    const providerId = pathParameters.providerId;
    if (!providerId) {
        return response_builder_1.ResponseBuilder.validation('Provider ID is required');
    }
    console.log(`[PROVIDER] Getting provider ${providerId} for user ${userId}`);
    const provider = await providerService.getProvider(providerId);
    if (!provider) {
        return response_builder_1.ResponseBuilder.notFound('Provider not found');
    }
    return response_builder_1.ResponseBuilder.success({ provider });
}
async function handleGetProviderExams(event, userId) {
    const { pathParameters } = (0, auth_middleware_1.extractRequestInfo)(event);
    const providerId = pathParameters.providerId;
    if (!providerId) {
        return response_builder_1.ResponseBuilder.validation('Provider ID is required');
    }
    console.log(`[PROVIDER] Getting exams for provider ${providerId} for user ${userId}`);
    const exams = await providerService.getProviderExams(providerId);
    return response_builder_1.ResponseBuilder.success({ exams });
}
//# sourceMappingURL=provider-handler.js.map