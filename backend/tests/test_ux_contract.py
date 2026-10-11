from pathlib import Path

from backend.predictor import Manifest, Predictor
from backend.schemas import ModelInfo, ProjectInput, ReviewNote


def project(**kwargs):
    return ProjectInput.model_validate(
        dict(
            country="Kenya",
            sector_code=12230,
            initial_budget_usd=500000,
            approval_month=12,
            approval_year=2024,
            **kwargs,
        )
    )


def test_structured_demo_notes_trace_to_inputs_and_retain_legacy_fields():
    notes = Predictor("demo", Path("unused")).notes(project())
    assert {n.code for n in notes} == {"round-budget", "missing-cpi", "approval-timing"}
    for note in notes:
        assert note.title and note.detail
        assert note.trigger and note.meaning and note.limits and note.next_step
    assert "500000" in notes[0].trigger
    assert "CPI" in notes[1].trigger
    assert "12" in notes[2].trigger


def test_legacy_contract_remains_valid():
    assert ReviewNote(code="legacy", title="Legacy", detail="Detail").trigger is None
    assert (
        ModelInfo(mode="model", version="v1", ready=True, limitations=[]).success_definition is None
    )
    fields = Manifest.model_fields
    for name in ("success_definition", "evaluation_horizon", "model_card_url"):
        assert name in fields
        assert not fields[name].is_required()


def test_model_card_rejects_unsafe_link_schemes():
    import pytest
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        ModelInfo(
            mode="model",
            version="v1",
            ready=True,
            limitations=[],
            model_card_url="javascript:alert(1)",
        )
