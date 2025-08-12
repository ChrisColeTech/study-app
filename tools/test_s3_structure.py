#!/usr/bin/env python3
"""
Test script to validate S3 structure for exam data upload
"""

import json
from pathlib import Path

def test_s3_structure():
    """Test the S3 upload structure matches our datasets"""
    
    print("🧪 TESTING S3 UPLOAD STRUCTURE")
    print("="*50)
    
    base_dir = Path("/mnt/c/Projects/study-app")
    final_dir = base_dir / "data/v2/final"
    
    if not final_dir.exists():
        print("❌ V2 final directory not found!")
        return False
    
    # Expected S3 paths from workflow
    expected_uploads = {
        "aif-c01_3_study_data.json": "questions/aws/aif-c01/set-3/questions.json",
        "aif-c01_6_study_data.json": "questions/aws/aif-c01/set-6/questions.json", 
        "clf-c02_2_study_data.json": "questions/aws/clf-c02/set-2/questions.json",
        "clf-c02_6_study_data.json": "questions/aws/clf-c02/set-6/questions.json",
        "sap-c02_6_study_data.json": "questions/aws/sap-c02/set-6/questions.json",
        "sap-c02_7_study_data.json": "questions/aws/sap-c02/set-7/questions.json",
        "sap-c02_8_study_data.json": "questions/aws/sap-c02/set-8/questions.json",
        "aws-sap-c02_pro8_study_data.json": "questions/aws/sap-c02/pro-8/questions.json"
    }
    
    print("📁 CHECKING FILE MAPPING:")
    total_questions = 0
    valid_files = 0
    
    for local_file, s3_path in expected_uploads.items():
        local_path = final_dir / local_file
        
        if local_path.exists():
            # Load and validate JSON structure
            try:
                with open(local_path) as f:
                    data = json.load(f)
                
                questions = len(data.get('study_data', []))
                metadata = data.get('metadata', {})
                
                print(f"✅ {local_file:<35} -> {s3_path}")
                print(f"   📊 Questions: {questions}, Answers: {metadata.get('processing_stats', {}).get('questions_with_answers', 'N/A')}")
                
                total_questions += questions
                valid_files += 1
                
            except Exception as e:
                print(f"❌ {local_file:<35} -> ERROR: {str(e)}")
        else:
            print(f"❌ {local_file:<35} -> FILE NOT FOUND")
    
    print("="*50)
    print(f"📊 SUMMARY:")
    print(f"  Valid files: {valid_files}/8")
    print(f"  Total questions: {total_questions}")
    print(f"  Upload ready: {'✅ YES' if valid_files == 8 else '❌ NO'}")
    
    # Test metadata generation
    print(f"\n📝 TESTING METADATA GENERATION:")
    
    # Simulate metadata structure
    metadata = {
        "providers": [
            {
                "id": "aws",
                "name": "Amazon Web Services",
                "totalQuestionSets": valid_files,
                "totalQuestions": total_questions,
                "exams": []
            }
        ]
    }
    
    # Group by exam type
    exam_groups = {}
    for local_file, s3_path in expected_uploads.items():
        local_path = final_dir / local_file
        if local_path.exists():
            # Extract exam code from S3 path
            parts = s3_path.split('/')
            if len(parts) >= 4:
                exam_code = parts[2]  # aws/EXAM_CODE/set/questions.json
                
                if exam_code not in exam_groups:
                    exam_groups[exam_code] = {"sets": [], "total_questions": 0}
                
                with open(local_path) as f:
                    data = json.load(f)
                question_count = len(data.get('study_data', []))
                
                exam_groups[exam_code]["sets"].append({
                    "file": local_file,
                    "questions": question_count
                })
                exam_groups[exam_code]["total_questions"] += question_count
    
    print(f"  Exam types found: {len(exam_groups)}")
    for exam_code, info in exam_groups.items():
        print(f"  - {exam_code.upper()}: {len(info['sets'])} sets, {info['total_questions']} questions")
    
    print(f"\n✅ S3 UPLOAD STRUCTURE VALIDATION COMPLETE")
    return valid_files == 8

if __name__ == "__main__":
    success = test_s3_structure()
    exit(0 if success else 1)