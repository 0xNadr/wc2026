"""Team → confederation lookup for the entire FIFA universe.

Used for hierarchical confederation-level shrinkage priors in the Bayesian
model. Covers all teams that appear in the martj42 dataset since 1990, plus
a few defunct or sub-national entities mapped to OTHER.
"""
from __future__ import annotations

from .tournament import QUALIFIED_TEAMS

# Build the full mapping. Qualified teams already have a confederation in
# QUALIFIED_TEAMS. Below: every other team that has appeared in international
# matches since 1990, grouped by confederation.

UEFA = {
    "Albania", "Andorra", "Armenia", "Austria", "Azerbaijan", "Belarus",
    "Belgium", "Bosnia and Herzegovina", "Bulgaria", "Croatia", "Cyprus",
    "Czech Republic", "Czechoslovakia", "Denmark", "England", "Estonia",
    "Faroe Islands", "Finland", "France", "Georgia", "Germany", "Gibraltar",
    "Greece", "Hungary", "Iceland", "Ireland", "Israel", "Italy", "Kosovo",
    "Latvia", "Liechtenstein", "Lithuania", "Luxembourg", "Malta", "Moldova",
    "Monaco", "Montenegro", "Netherlands", "North Macedonia",
    "Northern Ireland", "Norway", "Poland", "Portugal", "Romania", "Russia",
    "San Marino", "Scotland", "Serbia", "Slovakia", "Slovenia", "Spain",
    "Sweden", "Switzerland", "Turkey", "Ukraine", "Wales", "Yugoslavia",
    "German DR",
}

CONMEBOL = {
    "Argentina", "Bolivia", "Brazil", "Chile", "Colombia", "Ecuador",
    "Paraguay", "Peru", "Uruguay", "Venezuela",
}

CONCACAF = {
    "Anguilla", "Antigua and Barbuda", "Aruba", "Bahamas", "Barbados",
    "Belize", "Bermuda", "Bonaire", "British Virgin Islands", "Canada",
    "Cayman Islands", "Costa Rica", "Cuba", "Curaçao", "Dominica",
    "Dominican Republic", "El Salvador", "French Guiana", "Grenada",
    "Guadeloupe", "Guatemala", "Guyana", "Haiti", "Honduras", "Jamaica",
    "Martinique", "Mexico", "Montserrat", "Nicaragua", "Panama",
    "Puerto Rico", "Saint Kitts and Nevis", "Saint Lucia",
    "Saint Martin", "Saint Vincent and the Grenadines", "Sint Maarten", "Suriname",
    "Trinidad and Tobago", "Turks and Caicos Islands", "United States",
    "United States Virgin Islands",
}

CAF = {
    "Algeria", "Angola", "Benin", "Botswana", "Burkina Faso", "Burundi",
    "Cameroon", "Cape Verde", "Central African Republic", "Chad", "Comoros",
    "Congo", "DR Congo", "Djibouti", "Egypt", "Equatorial Guinea", "Eritrea",
    "Eswatini", "Ethiopia", "Gabon", "Gambia", "Ghana", "Guinea",
    "Guinea-Bissau", "Ivory Coast", "Kenya", "Lesotho", "Liberia", "Libya",
    "Madagascar", "Malawi", "Mali", "Mauritania", "Mauritius", "Morocco",
    "Mozambique", "Namibia", "Niger", "Nigeria", "Rwanda", "São Tomé and Príncipe",
    "Senegal", "Seychelles", "Sierra Leone", "Somalia", "South Africa",
    "South Sudan", "Sudan", "Swaziland", "Tanzania", "Togo", "Tunisia",
    "Uganda", "Zambia", "Zimbabwe", "Zaïre",
}

AFC = {
    "Afghanistan", "Australia", "Bahrain", "Bangladesh", "Bhutan", "Brunei",
    "Cambodia", "China", "China PR", "Chinese Taipei", "Guam", "Hong Kong", "India",
    "Indonesia", "Iran", "Iraq", "Japan", "Jordan", "Kazakhstan", "Kuwait",
    "Kyrgyzstan", "Laos", "Lebanon", "Macau", "Malaysia", "Maldives",
    "Mongolia", "Myanmar", "Nepal", "North Korea", "Oman", "Pakistan",
    "Palestine", "Philippines", "Qatar", "Saudi Arabia", "Singapore",
    "South Korea", "Sri Lanka", "Syria", "Taiwan", "Tajikistan", "Thailand",
    "Timor-Leste", "Turkmenistan", "United Arab Emirates", "Uzbekistan",
    "Vietnam", "Yemen",
}

OFC = {
    "American Samoa", "Cook Islands", "Fiji", "Kiribati", "New Caledonia",
    "New Zealand", "Niue", "Papua New Guinea", "Samoa", "Solomon Islands",
    "Tahiti", "Tonga", "Tuvalu", "Vanuatu",
}

# Sub-national teams, defunct entities, and edge cases that don't fit a
# confederation. These get treated as "OTHER" — given a generic prior with no
# confederation-level shrinkage. Fine because they're rarely qualified anyway.
OTHER = {
    "Andalusia", "Basque Country", "Catalonia", "Galicia", "Northern Cyprus",
    "Padania", "Sardinia", "Sicily", "Greenland", "Tibet", "Western Sahara",
    "Sápmi", "Romani people", "Kurdistan", "Western Armenia", "Lapland",
    "Saare County", "Frøya", "Hitra", "Iraqi Kurdistan", "Kabylia",
    "Provence", "Occitania", "Yorkshire", "Cornwall", "Brittany",
    "Felvidék", "Délvidék", "Republic of St. Pauli",
}

CONFEDERATIONS = ["UEFA", "CONMEBOL", "CONCACAF", "CAF", "AFC", "OFC", "OTHER"]

_TEAM_TO_CONF: dict[str, str] = {}
for conf, teams in [
    ("UEFA", UEFA), ("CONMEBOL", CONMEBOL), ("CONCACAF", CONCACAF),
    ("CAF", CAF), ("AFC", AFC), ("OFC", OFC), ("OTHER", OTHER),
]:
    for t in teams:
        _TEAM_TO_CONF[t] = conf

# Qualified teams override (in case of mismatches)
for team, info in QUALIFIED_TEAMS.items():
    _TEAM_TO_CONF[team] = info["confederation"]


def get_confederation(team: str) -> str:
    """Return the confederation for a team, defaulting to OTHER."""
    return _TEAM_TO_CONF.get(team, "OTHER")


def confederation_indices(teams: list[str]) -> tuple[list[int], list[str]]:
    """Return (per-team confederation index, ordered confederation names).

    Used to construct the model coords for hierarchical shrinkage.
    """
    confs_used = sorted(set(get_confederation(t) for t in teams),
                        key=lambda c: CONFEDERATIONS.index(c))
    conf_to_idx = {c: i for i, c in enumerate(confs_used)}
    return [conf_to_idx[get_confederation(t)] for t in teams], confs_used
