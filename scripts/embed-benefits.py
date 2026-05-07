"""
embed-benefits.py — generate semantic/benefit-embeddings.json

Run once before deploy:
  pip install sentence-transformers
  python scripts/embed-benefits.py
"""
import json, os
from sentence_transformers import SentenceTransformer

CORPUS = {
    "pain-suffering": (
        "Pain and Suffering Compensation monthly tax-free payment veteran service-related disability "
        "injury illness PTSD chronic pain mental health condition caused by military service CAF "
        "Canadian Armed Forces compensation percentage disability assessment entitlement"
    ),
    "income-replacement": (
        "Income Replacement Benefit IRB unable to work unemployable medical release career ending "
        "injury lost career cant hold a job cant function workplace destroyed capacity earn income "
        "financial support released soldier cant work anymore Kandahar Afghanistan deployment "
        "vocational impairment rehab enrolled DEC diminished earning capacity"
    ),
    "caregiver-recognition": (
        "Caregiver Recognition Benefit informal caregiver family member spouse partner caring for "
        "severely disabled veteran at home daily care tasks unable to care for themselves dependent "
        "on family support recognition payment"
    ),
    "veterans-independence": (
        "Veterans Independence Program VIP home care housekeeping yard work snow removal meal "
        "preparation grocery shopping personal hygiene bathing laundry transportation mobility "
        "physical limitation cant manage home independently chronic condition stay at home "
        "independent living home maintenance cleaning"
    ),
    "education-training": (
        "Education and Training Benefit ETB school college university post-secondary training "
        "retraining career change new job tuition certification trade apprentice diploma degree "
        "go back to school learn new skills civilian career after military release"
    ),
    "rehabilitation": (
        "Rehabilitation Program free therapy treatment physical mental health psychologist "
        "physiotherapy occupational therapy vocational rehabilitation counselling healing recovery "
        "PTSD treatment substance use back to work reintegration civilian life treatment plan "
        "drinking too much mental health falling apart struggling since release"
    ),
    "case-management": (
        "Case Management Services dedicated VAC case manager coordinate benefits complex file "
        "overwhelmed confused navigating system multiple conditions multiple benefits need help "
        "figuring out bureaucracy support coordinator guidance complicated paperwork lost"
    ),
    "long-term-care": (
        "Long Term Care Program nursing home residential care facility 24-hour care "
        "severe disability advanced age dementia Alzheimers wheelchair completely dependent "
        "cannot live alone cant function independently institutional care frail elder care "
        "cant afford nursing home dad mom parent placement"
    ),
    "disability-benefits": (
        "Disability Benefits Pension Act veterans who served before April 2006 World War Two "
        "Korean War cold war peacekeeping Gulf War Bosnia Somalia Croatia traditional pension "
        "old system pre-2006 service disability pension"
    ),
    "funeral-burial": (
        "Funeral and Burial Program veteran death died passed away deceased funeral costs "
        "burial cemetery cremation grave marker memorial services Last Post Fund financial "
        "assistance funeral expenses estate unable to afford funeral bereavement"
    ),
}

def main():
    os.makedirs("semantic", exist_ok=True)
    print("Loading all-MiniLM-L6-v2...")
    model = SentenceTransformer("all-MiniLM-L6-v2")

    embeddings = {}
    for benefit_id, text in CORPUS.items():
        vec = model.encode(text, normalize_embeddings=True).tolist()
        embeddings[benefit_id] = vec
        print(f"  {benefit_id}: {len(vec)}-dim")

    out_path = "semantic/benefit-embeddings.json"
    with open(out_path, "w") as f:
        json.dump(embeddings, f, separators=(",", ":"))

    size_kb = os.path.getsize(out_path) / 1024
    print(f"\nWrote {out_path} ({size_kb:.1f} KB, {len(embeddings)} benefits)")

if __name__ == "__main__":
    main()
