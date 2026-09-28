"""Input bounds for the recovered DNA renderer."""
def validate(spec):
    if not isinstance(spec, dict):
        raise ValueError("Expected a DNA feature-map JSON object")
    for key in ("id", "name", "sequence"):
        if not isinstance(spec.get(key), str) or not spec[key].strip():
            raise ValueError(f"{key} must be a non-empty string")
    if len(spec["id"]) > 100 or len(spec["name"]) > 100:
        raise ValueError("id and name must be at most 100 characters")
    sequence = spec["sequence"]
    if len(sequence) > 20000 or any(c.upper() not in "ACGTRYSWKMBDHVN" for c in sequence):
        raise ValueError("sequence must contain 1–20000 DNA bases (IUPAC letters)")
    features = spec.get("features")
    if not isinstance(features, list) or len(features) > 100:
        raise ValueError("features must be an array of at most 100 annotations")
    width = spec.get("figure_width", 10)
    if type(width) not in (int, float) or not 3 <= width <= 16:
        raise ValueError("figure_width must be between 3 and 16")
    for f in features:
        if not isinstance(f, dict):
            raise ValueError("Each feature must be an object")
        if type(f.get("start")) is not int or type(f.get("end")) is not int or not 0 <= f["start"] < f["end"] <= len(sequence):
            raise ValueError("Feature coordinates must satisfy 0 <= start < end <= sequence length")
        if type(f.get("strand")) is not int or f["strand"] not in (-1, 1):
            raise ValueError("Feature strand must be -1 or 1")
        for key in ("label", "type"):
            if not isinstance(f.get(key), str) or not 1 <= len(f[key]) <= 100:
                raise ValueError(f"Feature {key} must contain 1–100 characters")
        if "color" in f:
            from matplotlib.colors import is_color_like
            if not isinstance(f["color"], str) or not is_color_like(f["color"]):
                raise ValueError("Feature color must be a valid plotting color")
