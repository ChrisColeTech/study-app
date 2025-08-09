"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const provider_service_1 = require("../services/provider-service");
const response_builder_1 = require("../shared/response-builder");
const providerService = new provider_service_1.ProviderService();
const handler = async (event) => {
    try {
        const { httpMethod, resource, pathParameters } = event;
        // Handle OPTIONS request for CORS
        if (httpMethod === 'OPTIONS') {
            return response_builder_1.ResponseBuilder.success('', 200);
        }
        // Debug: Log request context to see what authorizer data is available
        console.log('Request context:', JSON.stringify(event.requestContext, null, 2));
        console.log('Authorizer data:', JSON.stringify(event.requestContext.authorizer, null, 2));
        // Check authorization
        const userId = event.requestContext.authorizer?.userId;
        console.log('Extracted userId:', userId);
        if (!userId) {
            return response_builder_1.ResponseBuilder.unauthorized('User not authenticated');
        }
        switch (`${httpMethod} ${resource}`) {
            case 'GET /api/v1/providers':
                return await handleGetProviders(event);
            case 'GET /api/v1/providers/{providerId}':
                return await handleGetProvider(event);
            case 'GET /api/v1/providers/{providerId}/exams':
                return await handleGetProviderExams(event);
            default:
                return response_builder_1.ResponseBuilder.notFound('Route not found');
        }
    }
    catch (error) {
        console.error('Provider handler error:', error);
        return response_builder_1.ResponseBuilder.error(error instanceof Error ? error.message : 'Internal server error');
    }
};
exports.handler = handler;
async function handleGetProviders(event) {
    try {
        const result = await providerService.getProviders();
        return response_builder_1.ResponseBuilder.success(result);
    }
    catch (error) {
        throw error;
    }
}
async function handleGetProvider(event) {
    try {
        const providerId = event.pathParameters?.providerId;
        if (!providerId) {
            return response_builder_1.ResponseBuilder.validation('Provider ID is required');
        }
        const provider = await providerService.getProvider(providerId);
        if (!provider) {
            return response_builder_1.ResponseBuilder.notFound('Provider not found');
        }
        return response_builder_1.ResponseBuilder.success({ provider });
    }
    catch (error) {
        throw error;
    }
}
async function handleGetProviderExams(event) {
    try {
        const providerId = event.pathParameters?.providerId;
        if (!providerId) {
            return response_builder_1.ResponseBuilder.validation('Provider ID is required');
        }
        const exams = await providerService.getProviderExams(providerId);
        return response_builder_1.ResponseBuilder.success({ exams });
    }
    catch (error) {
        throw error;
    }
}
//# sourceMappingURL=provider-handler.js.map