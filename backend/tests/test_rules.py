from app.services.qualification import rules_only

def test_missing_address_is_reported():
    result=rules_only('Please inspect our office HVAC next week')
    assert 'site_address_or_postcode' in result['missing_fields']
    assert result['needs_human_review'] is True

def test_emergency_language_is_flagged():
    result=rules_only('There is a gas leak at our premises')
    assert result['urgency']=='emergency'
    assert result['needs_human_review'] is True
