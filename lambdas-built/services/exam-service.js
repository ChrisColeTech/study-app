"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExamService = void 0;
const provider_service_1 = require("./provider-service");
const question_service_1 = require("./question-service");
class ExamService {
    constructor() {
        this.providerService = new provider_service_1.ProviderService();
        this.questionService = new question_service_1.QuestionService();
    }
    async getAllExams() {
        const providerData = await this.providerService.getProviders();
        const allExams = [];
        const providerNames = [];
        providerData.providers.forEach(provider => {
            providerNames.push(provider.id);
            provider.exams.forEach(exam => {
                allExams.push({
                    ...exam,
                    providerId: provider.id,
                    providerName: provider.name,
                });
            });
        });
        return {
            exams: allExams,
            totalExams: allExams.length,
            providers: providerNames,
        };
    }
    async getExamById(examId, providerId) {
        // If providerId is specified, look in that provider first
        if (providerId) {
            const result = await this.providerService.getExamDetails(providerId, examId);
            if (result) {
                return result;
            }
        }
        // Otherwise, search all providers for the exam
        const providerData = await this.providerService.getProviders();
        for (const provider of providerData.providers) {
            const exam = provider.exams.find(e => e.id === examId);
            if (exam) {
                const result = await this.providerService.getExamDetails(provider.id, examId);
                if (result) {
                    return result;
                }
            }
        }
        return null;
    }
    async getExamTopics(examId, providerId) {
        let targetProviderId = providerId;
        // If no provider specified, find which provider has this exam
        if (!targetProviderId) {
            const providerData = await this.providerService.getProviders();
            for (const provider of providerData.providers) {
                const exam = provider.exams.find(e => e.id === examId);
                if (exam && exam.questionCount > 0) {
                    targetProviderId = provider.id;
                    break;
                }
            }
        }
        if (!targetProviderId) {
            return null;
        }
        try {
            const topics = await this.questionService.getAvailableTopics(targetProviderId, examId);
            // Get topic counts
            const questions = await this.questionService.getQuestions({
                provider: targetProviderId,
                exam: examId,
                limit: 1000,
            });
            const topicCounts = {};
            questions.questions.forEach(q => {
                const topic = q.question.topic;
                topicCounts[topic] = (topicCounts[topic] || 0) + 1;
            });
            return {
                examId,
                providerId: targetProviderId,
                topics: topics,
                topicCounts,
            };
        }
        catch (error) {
            console.error(`Error loading topics for exam ${examId}:`, error);
            return {
                examId,
                providerId: targetProviderId,
                topics: [],
                topicCounts: {},
            };
        }
    }
    async searchExams(query) {
        const allExamsData = await this.getAllExams();
        const searchLower = query.toLowerCase();
        const matchingExams = allExamsData.exams.filter(exam => exam.name.toLowerCase().includes(searchLower) ||
            exam.description.toLowerCase().includes(searchLower) ||
            exam.id.toLowerCase().includes(searchLower) ||
            exam.providerName?.toLowerCase().includes(searchLower));
        return {
            exams: matchingExams,
            totalResults: matchingExams.length,
            searchQuery: query,
        };
    }
    async getExamsByProvider(providerId) {
        const provider = await this.providerService.getProvider(providerId);
        if (!provider)
            return null;
        return {
            provider,
            exams: provider.exams,
        };
    }
}
exports.ExamService = ExamService;
//# sourceMappingURL=exam-service.js.map