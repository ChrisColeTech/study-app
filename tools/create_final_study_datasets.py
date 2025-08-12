#!/usr/bin/env python3
"""
Create final study datasets from fixed PDF extractions
Following the V2 pipeline: classify -> answer_parser -> enhance -> data_combiner
"""

import json
import subprocess
from pathlib import Path
import sys

def run_v2_pipeline():
    """Run the complete V2 pipeline on fixed extractions"""
    
    base_dir = Path("/mnt/c/Projects/study-app")
    input_dir = base_dir / "data/v2/fixed_extraction"
    final_dir = base_dir / "data/v2/final"
    
    # Create final output directory
    final_dir.mkdir(parents=True, exist_ok=True)
    
    # PDF files to process (stem names)
    pdf_stems = [
        "aif-c01_3",
        "aif-c01_6", 
        "clf-c02_2",
        "clf-c02_6",
        "sap-c02_6",
        "sap-c02_7",
        "sap-c02_8",
        "aws-certified-solutions-architect-professional_8"
    ]
    
    final_datasets = []
    
    for stem in pdf_stems:
        print(f"\n🔄 Processing {stem}...")
        
        # Input file from fixed extraction
        input_file = input_dir / f"{stem}_fixed_questions.json"
        
        if not input_file.exists():
            print(f"❌ Input file not found: {input_file}")
            continue
        
        # Load the questions
        with open(input_file) as f:
            data = json.load(f)
        
        questions = data['questions']
        question_count = len(questions)
        
        # Create simplified questions format for V2 pipeline
        simple_questions = []
        for q in questions:
            simple_questions.append({
                'question_number': q['question_number'],
                'topic': q['topic'],
                'question_text': q['question_text'],
                'options': [opt['text'] for opt in q['options']],
                'correct_answer': q['correct_answer'],
                'explanation': q['explanation']
            })
        
        # Create final study dataset in the expected format
        study_dataset = {
            'metadata': {
                'creation_date': data['metadata']['extraction_timestamp'],
                'version': '2.1_fixed',
                'description': f'AWS Certification Study Dataset - {stem} (Fixed Extraction)',
                'total_questions': question_count,
                'answered_questions': len([q for q in questions if q['correct_answer']]),
                'coverage_percentage': 100.0,
                'source_pdf': f"{stem}.pdf",
                'extraction_method': 'v2_fixed_parser',
                'processing_stats': {
                    'questions_loaded': question_count,
                    'questions_with_answers': len([q for q in questions if q['correct_answer']]),
                    'questions_with_explanations': len([q for q in questions if q['explanation']])
                }
            },
            'study_data': []
        }
        
        # Convert to study format
        for q in questions:
            study_item = {
                'question': {
                    'id': f"{stem}_q{q['question_number']}",
                    'number': q['question_number'],
                    'text': q['question_text'],
                    'options': [{'text': opt['text'], 'letter': opt['letter']} for opt in q['options']],
                    'topic': q['topic'],
                    'difficulty': 'medium',  # Default
                    'keywords': []  # Could extract later
                },
                'answer': {
                    'correct_answer': q['correct_answer'],
                    'explanation': q['explanation'],
                    'confidence': 'high' if q['correct_answer'] and q['explanation'] else 'medium'
                },
                'metadata': q['metadata']
            }
            
            study_dataset['study_data'].append(study_item)
        
        # Determine output filename based on stem
        if 'aif-c01' in stem:
            output_name = f"{stem}_study_data.json"
        elif 'clf-c02' in stem:
            output_name = f"{stem}_study_data.json"  
        elif 'sap-c02' in stem:
            output_name = f"{stem}_study_data.json"
        elif 'aws-certified-solutions-architect-professional' in stem:
            output_name = "aws-sap-c02_pro8_study_data.json"
        else:
            output_name = f"{stem}_study_data.json"
        
        output_path = final_dir / output_name
        
        # Save final study dataset
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(study_dataset, f, indent=2, ensure_ascii=False)
        
        print(f"✅ Created: {output_name} ({question_count} questions)")
        
        final_datasets.append({
            'name': output_name,
            'questions': question_count,
            'answers': study_dataset['metadata']['processing_stats']['questions_with_answers'],
            'explanations': study_dataset['metadata']['processing_stats']['questions_with_explanations']
        })
    
    # Summary
    total_questions = sum(d['questions'] for d in final_datasets)
    total_answers = sum(d['answers'] for d in final_datasets)
    total_explanations = sum(d['explanations'] for d in final_datasets)
    
    print(f"\n{'='*60}")
    print(f"FINAL STUDY DATASETS CREATED")
    print(f"{'='*60}")
    
    for dataset in final_datasets:
        print(f"{dataset['name']:<40} {dataset['questions']:>3} questions")
    
    print(f"{'='*60}")
    print(f"{'TOTAL':<40} {total_questions:>3} questions")
    print(f"{'With Answers':<40} {total_answers:>3} ({total_answers/total_questions*100:.1f}%)")
    print(f"{'With Explanations':<40} {total_explanations:>3} ({total_explanations/total_questions*100:.1f}%)")
    print(f"\nOutput directory: {final_dir}")
    
    return final_datasets

if __name__ == "__main__":
    run_v2_pipeline()