# V2 Topic Grouping Strategy

## Multi-Certification Topic Organization

### Certification-Specific Grouping

#### CLF-C02 (Cloud Practitioner) Topics
1. **Topic 1 - Cloud Concepts** - Basic cloud computing principles
2. **Topic 2 - Security & Compliance** - Identity, access, security services
3. **Topic 3 - Technology** - Core AWS services and features
4. **Topic 4 - Billing & Pricing** - Cost management and pricing models

#### SAP-C02 (Solutions Architect Professional) Topics  
1. **Topic 1 - Design Solutions for Organizational Complexity** - Multi-account, governance
2. **Topic 2 - Design for New Solutions** - Architecture patterns, best practices
3. **Topic 3 - Migration Planning** - Migration strategies and tools
4. **Topic 4 - Cost Control** - Cost optimization and monitoring
5. **Topic 5 - Continuous Improvement** - Monitoring, automation, optimization

#### AIF-C01 (AI Practitioner) Topics
1. **Topic 1 - AI/ML Fundamentals** - Basic concepts and terminology
2. **Topic 2 - AWS AI Services** - Recognition, analysis, chatbots
3. **Topic 3 - Machine Learning** - SageMaker, training, inference
4. **Topic 4 - Implementation** - Best practices, governance, ethics

## Topic Detection Strategy

### Automatic Classification
Use PDF topic markers where available:
- `(Topic 3)` in SurePassExam format
- `Question 1:` numbering in other formats

### Manual Classification  
For PDFs without clear topic markers:
- Group by AWS service keywords
- Sequence-based grouping (questions 1-30 = Topic 1, etc.)
- Content analysis for service categories

## Final Output Structure

Each certification maintains separate topic structure:
```json
{
  "topics": [
    {
      "topic_id": 1,
      "topic_name": "Topic 1 - Cloud Concepts", 
      "question_count": 30,
      "questions": [...]
    }
  ]
}
```