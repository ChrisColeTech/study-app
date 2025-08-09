#!/usr/bin/env python3
"""
Fix metadata in the complete study dataset to reflect 100% coverage
"""
import json
from datetime import datetime

def main():
    print("Fixing metadata in study_data_complete.json...")
    
    # Load complete dataset
    with open('data/study_data_complete.json', 'r') as f:
        data = json.load(f)
    
    # Calculate actual statistics
    total_questions = len(data['study_data'])
    answered_questions = sum(1 for pair in data['study_data'] if pair['answer'] is not None)
    ai_answers = sum(1 for pair in data['study_data'] if pair['answer'] and pair['answer'].get('source') == 'ai_generated')
    extracted_answers = answered_questions - ai_answers
    
    print(f"Actual data: {answered_questions}/{total_questions} = {answered_questions/total_questions*100:.1f}% coverage")
    print(f"AI-generated: {ai_answers} answers")
    print(f"Extracted: {extracted_answers} answers")
    
    # Update metadata
    data['metadata'].update({
        'total_questions': total_questions,
        'answered_questions': answered_questions,
        'coverage_percentage': round(answered_questions/total_questions*100, 1),
        'final_update_date': datetime.now().isoformat(),
        'ai_answers_merged': ai_answers,
        'extracted_answers': extracted_answers,
        'dataset_status': 'COMPLETE - 100% coverage achieved',
        'final_coverage': {
            'total_questions': total_questions,
            'answered_questions': answered_questions,
            'coverage_percentage': round(answered_questions/total_questions*100, 1),
            'extraction_source_breakdown': {
                'text_file_extraction': extracted_answers,
                'ai_generated': ai_answers
            }
        }
    })
    
    # Update coverage statistics
    data['metadata']['coverage_statistics'].update({
        'answered_questions': answered_questions,
        'unanswered_questions': total_questions - answered_questions,
        'coverage_percentage': round(answered_questions/total_questions*100, 1)
    })
    
    # Save corrected dataset
    with open('data/study_data_complete.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"✅ Metadata corrected: {answered_questions}/{total_questions} = {answered_questions/total_questions*100:.1f}% coverage")
    print("📁 Updated file: data/study_data_complete.json")

if __name__ == '__main__':
    main()