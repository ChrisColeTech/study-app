#!/usr/bin/env python3
"""
Consolidate overlapping exam datasets into unified sets
Removes duplicate questions and creates clean, merged datasets
"""

import json
import hashlib
from pathlib import Path
from collections import defaultdict
from datetime import datetime

def hash_question_content(question_text, options):
    """Create hash of question content to identify duplicates"""
    # Normalize text for comparison
    normalized_text = question_text.lower().strip()
    normalized_options = [opt['text'].lower().strip() for opt in options]
    
    # Create content string
    content = normalized_text + '|' + '|'.join(sorted(normalized_options))
    
    # Return hash
    return hashlib.md5(content.encode('utf-8')).hexdigest()[:12]

def consolidate_exam_datasets():
    """Merge overlapping exam datasets into consolidated versions"""
    
    print("🔄 CONSOLIDATING EXAM DATASETS")
    print("="*60)
    
    base_dir = Path(".")
    source_dir = base_dir / "data/v2/final"
    output_dir = base_dir / "data/v2/consolidated"
    
    # Create output directory
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Group datasets by exam type
    exam_groups = {
        'aif-c01': [],
        'clf-c02': [], 
        'sap-c02': []  # All SAP-C02 variants go here
    }
    
    # Find all datasets
    for dataset_file in source_dir.glob("*.json"):
        if 'aif-c01' in dataset_file.name:
            exam_groups['aif-c01'].append(dataset_file)
        elif 'clf-c02' in dataset_file.name:
            exam_groups['clf-c02'].append(dataset_file)
        elif 'sap-c02' in dataset_file.name or 'aws-sap-c02' in dataset_file.name:
            exam_groups['sap-c02'].append(dataset_file)  # All SAP-C02 variants
    
    consolidated_datasets = []
    total_original = 0
    total_consolidated = 0
    
    for exam_type, files in exam_groups.items():
        if not files:
            continue
            
        print(f"\n📚 Processing {exam_type.upper()}")
        print("-" * 40)
        
        # Track unique questions by content hash
        unique_questions = {}  # hash -> question_data
        question_metadata = defaultdict(list)  # hash -> [source_files]
        
        exam_name = ""
        exam_description = ""
        
        # Process all files for this exam type
        for file_path in files:
            print(f"  📖 Loading {file_path.name}...")
            
            with open(file_path) as f:
                data = json.load(f)
            
            # Get exam metadata from first file
            if not exam_name:
                metadata = data.get('metadata', {})
                exam_name = metadata.get('description', f'{exam_type.upper()} Study Dataset')
                exam_description = f"Consolidated {exam_type.upper()} certification questions"
            
            questions = data['study_data']
            total_original += len(questions)
            
            print(f"    Questions in set: {len(questions)}")
            
            # Process each question
            for question_item in questions:
                question = question_item['question']
                answer = question_item['answer']
                
                # Create content hash
                content_hash = hash_question_content(question['text'], question['options'])
                
                # Track source
                question_metadata[content_hash].append({
                    'file': file_path.name,
                    'question_number': question['number']
                })
                
                # Keep first occurrence of each unique question
                if content_hash not in unique_questions:
                    # Clean up the question data
                    consolidated_question = {
                        'question': {
                            'id': f"{exam_type}_{content_hash}",
                            'number': len(unique_questions) + 1,  # Sequential numbering
                            'text': question['text'],
                            'options': question['options'],
                            'topic': question.get('topic', 'General'),
                            'difficulty': question.get('difficulty', 'medium'),
                            'keywords': question.get('keywords', [])
                        },
                        'answer': {
                            'correct_answer': answer['correct_answer'],
                            'explanation': answer.get('explanation', ''),
                            'confidence': answer.get('confidence', 'high')
                        },
                        'metadata': {
                            'content_hash': content_hash,
                            'sources': [],  # Will be filled below
                            'extraction_method': 'consolidated_v2',
                            'consolidation_date': datetime.now().isoformat()
                        }
                    }
                    
                    unique_questions[content_hash] = consolidated_question
        
        # Update source information
        for content_hash, question_data in unique_questions.items():
            sources = question_metadata[content_hash]
            question_data['metadata']['sources'] = sources
            
            if len(sources) > 1:
                # Mark as duplicate found in multiple sources
                source_files = list(set([s['file'] for s in sources]))
                question_data['metadata']['duplicate_sources'] = source_files
        
        # Create consolidated dataset
        consolidated_count = len(unique_questions)
        total_consolidated += consolidated_count
        
        duplicates_removed = total_original - total_consolidated
        
        consolidated_dataset = {
            'metadata': {
                'exam_code': exam_type,
                'name': exam_name,
                'description': exam_description,
                'creation_date': datetime.now().isoformat(),
                'version': '2.1-consolidated',
                'total_questions': consolidated_count,
                'answered_questions': consolidated_count,
                'coverage_percentage': 100.0,
                'consolidation_stats': {
                    'source_files': [f.name for f in files],
                    'original_questions': sum(len(json.load(open(f))['study_data']) for f in files),
                    'unique_questions': consolidated_count,
                    'duplicates_removed': sum(len(json.load(open(f))['study_data']) for f in files) - consolidated_count
                },
                'data_quality': {
                    'answer_coverage': '100%',
                    'explanation_coverage': f"{sum(1 for q in unique_questions.values() if q['answer']['explanation']) / consolidated_count * 100:.1f}%"
                }
            },
            'study_data': list(unique_questions.values())
        }
        
        # Save consolidated dataset
        output_file = output_dir / f"{exam_type}-consolidated_study_data.json"
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(consolidated_dataset, f, indent=2, ensure_ascii=False)
        
        # Report results
        original_total = sum(len(json.load(open(f))['study_data']) for f in files)
        duplicates = original_total - consolidated_count
        
        print(f"  ✅ Consolidated: {consolidated_count} unique questions")
        print(f"  📊 Removed {duplicates} duplicates from {len(files)} source files")
        print(f"  💾 Saved to: {output_file.name}")
        
        consolidated_datasets.append({
            'exam_type': exam_type,
            'file': output_file.name,
            'unique_questions': consolidated_count,
            'duplicates_removed': duplicates,
            'source_files': len(files)
        })
    
    # Final summary
    print("\n" + "="*60)
    print("📊 CONSOLIDATION SUMMARY")
    print("="*60)
    
    for dataset in consolidated_datasets:
        print(f"{dataset['exam_type'].upper():<10} {dataset['unique_questions']:>3} questions ({dataset['duplicates_removed']} duplicates removed from {dataset['source_files']} files)")
    
    print("-" * 60)
    print(f"{'TOTAL':<10} {sum(d['unique_questions'] for d in consolidated_datasets):>3} unique questions")
    print(f"{'REMOVED':<10} {sum(d['duplicates_removed'] for d in consolidated_datasets):>3} duplicate questions")
    print(f"{'SAVED':<10} {sum(d['duplicates_removed'] for d in consolidated_datasets):>3} redundant questions eliminated")
    
    print(f"\n✅ Consolidated datasets saved to: {output_dir}")
    print(f"📈 Storage efficiency: {sum(d['duplicates_removed'] for d in consolidated_datasets) / (sum(d['unique_questions'] for d in consolidated_datasets) + sum(d['duplicates_removed'] for d in consolidated_datasets)) * 100:.1f}% reduction")
    
    return consolidated_datasets

if __name__ == "__main__":
    consolidate_exam_datasets()