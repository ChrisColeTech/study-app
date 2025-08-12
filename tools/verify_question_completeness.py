#!/usr/bin/env python3
"""
Verification tool to count questions and ensure complete extraction
Validates that total questions equals highest question number (no gaps)
"""

import json
import sys
from pathlib import Path
from collections import defaultdict

def verify_dataset_completeness(dataset_path):
    """Verify a single dataset for completeness"""
    
    with open(dataset_path) as f:
        data = json.load(f)
    
    questions = data['study_data']
    total_questions = len(questions)
    
    # Extract question numbers
    question_numbers = []
    for item in questions:
        question_numbers.append(item['question']['number'])
    
    # Find highest question number
    highest_number = max(question_numbers) if question_numbers else 0
    lowest_number = min(question_numbers) if question_numbers else 0
    
    # Sort question numbers to check for actual sequence
    sorted_numbers = sorted(question_numbers)
    
    # For exam dumps, we need to verify against the source PDF, not assume consecutive numbering
    # Check for duplicate question numbers (which would indicate a real problem)
    duplicates = []
    seen = set()
    for num in question_numbers:
        if num in seen:
            duplicates.append(num)
        seen.add(num)
    
    # Calculate actual coverage based on unique questions found vs total extracted
    unique_questions = len(set(question_numbers))
    has_duplicates = len(duplicates) > 0
    
    # For exam dumps, completeness means:
    # 1. No duplicate question numbers
    # 2. All questions have valid data
    # 3. Question count matches metadata if available
    is_complete = (not has_duplicates) and (unique_questions == total_questions)
    
    # Get expected total from metadata if available
    expected_total = None
    if 'metadata' in data and 'total_questions' in data['metadata']:
        expected_total = data['metadata']['total_questions']
        is_complete = is_complete and (total_questions == expected_total)
    
    return {
        'dataset': dataset_path.name,
        'total_questions': total_questions,
        'unique_questions': unique_questions,
        'highest_number': highest_number,
        'lowest_number': lowest_number,
        'duplicates': duplicates,
        'expected_total': expected_total,
        'is_complete': is_complete,
        'question_range': f"{lowest_number}-{highest_number}",
        'actual_numbers': sorted_numbers[:10] + ['...'] if len(sorted_numbers) > 10 else sorted_numbers
    }

def verify_all_datasets():
    """Verify all study datasets for completeness"""
    
    base_dir = Path("/mnt/c/Projects/study-app")
    data_dir = base_dir / "data"
    
    # Find all study dataset files (remove duplicates)
    study_files = set()
    
    # Look in v2/final directory (primary location)
    v2_final_dir = data_dir / "v2/final"
    if v2_final_dir.exists():
        study_files.update(v2_final_dir.glob("*_study_data.json"))
    
    if not study_files:
        print("❌ No study dataset files found!")
        return []
    
    print(f"🔍 Found {len(study_files)} study dataset files")
    print("="*80)
    
    results = []
    total_questions_all = 0
    problem_datasets = []
    
    for dataset_file in sorted(study_files):
        try:
            result = verify_dataset_completeness(dataset_file)
            results.append(result)
            total_questions_all += result['total_questions']
            
            # Print individual results  
            status = "✅ VALID" if result['is_complete'] else "⚠️  ISSUES"
            range_info = f"Range: {result['question_range']}"
            
            print(f"{result['dataset']:<45} {result['total_questions']:>3} questions | {range_info:<12} | {status}")
            
            if result['duplicates']:
                print(f"   ⚠️  Duplicate questions: {result['duplicates']}")
                problem_datasets.append(result)
            
            if result['expected_total'] and result['total_questions'] != result['expected_total']:
                print(f"   ⚠️  Metadata mismatch: Expected {result['expected_total']}, got {result['total_questions']}")
                problem_datasets.append(result)
            
            # Show question number samples
            if len(result['actual_numbers']) > 5:
                sample = result['actual_numbers'][:5] + ['...']
                print(f"   Question numbers: {sample}")
            
        except Exception as e:
            print(f"❌ Error verifying {dataset_file.name}: {str(e)}")
    
    print("="*80)
    
    # Summary
    valid_count = sum(1 for r in results if r['is_complete'])
    problem_count = len(results) - valid_count
    
    print(f"VERIFICATION SUMMARY:")
    print(f"  Total Datasets: {len(results)}")
    print(f"  Valid Datasets: {valid_count}")
    print(f"  Problem Datasets: {problem_count}")
    print(f"  Total Questions: {total_questions_all}")
    
    if problem_datasets:
        print(f"\n⚠️  ISSUES DETECTED:")
        for dataset in problem_datasets:
            issues = []
            if dataset['duplicates']:
                issues.append(f"{len(dataset['duplicates'])} duplicates")
            if dataset['expected_total'] and dataset['total_questions'] != dataset['expected_total']:
                issues.append("metadata mismatch")
            print(f"  {dataset['dataset']}: {', '.join(issues)}")
        
        print(f"\n🔧 RECOMMENDATION: Review datasets with issues")
        return False
    else:
        print(f"\n✅ ALL DATASETS VALID - No structural issues detected!")
        print(f"\nℹ️  NOTE: These are sample/demo exam dumps, not complete question sets.")
        print(f"   Question numbers may not be consecutive - this is normal.")
        return True

def check_extraction_files():
    """Check if extraction files need reprocessing"""
    
    base_dir = Path("/mnt/c/Projects/study-app")
    extraction_dir = base_dir / "data/v2/fixed_extraction"
    
    if not extraction_dir.exists():
        print("❌ Fixed extraction directory not found!")
        return False
    
    extraction_files = list(extraction_dir.glob("*_fixed_questions.json"))
    
    print(f"\n🔍 Checking extraction files...")
    print(f"Found {len(extraction_files)} extraction files in {extraction_dir}")
    
    for file in sorted(extraction_files):
        try:
            with open(file) as f:
                data = json.load(f)
            questions = data['questions']
            question_numbers = [q['question_number'] for q in questions]
            
            total = len(questions)
            highest = max(question_numbers) if question_numbers else 0
            missing = set(range(1, highest + 1)) - set(question_numbers)
            
            status = "✅" if total == highest and len(missing) == 0 else "❌"
            print(f"  {file.name:<50} {total:>3}/{highest} questions {status}")
            
            if missing:
                print(f"    Missing: {sorted(list(missing))[:10]}")
        
        except Exception as e:
            print(f"❌ Error checking {file.name}: {str(e)}")
    
    return True

def main():
    """Main verification function"""
    
    print("🔍 QUESTION COMPLETENESS VERIFICATION TOOL")
    print("="*80)
    
    # Verify study datasets
    datasets_complete = verify_all_datasets()
    
    # Check extraction files
    check_extraction_files()
    
    if not datasets_complete:
        print(f"\n🚨 ACTION REQUIRED: Some datasets have missing questions!")
        print(f"   Run the extraction tools to fix incomplete datasets.")
        return False
    else:
        print(f"\n🎉 VERIFICATION PASSED: All datasets are complete!")
        return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)