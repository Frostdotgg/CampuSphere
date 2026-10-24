-- Additive only. Apply to a verified target after backup and owner authorization.
-- No existing Vehicle entry steps or route geometry are changed.
CREATE TABLE IF NOT EXISTS campus_route_instruction_lists (
    destination_building_id INT NOT NULL,
    mode VARCHAR(7) NOT NULL,
    direction VARCHAR(5) NOT NULL,
    steps JSON NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (destination_building_id, mode, direction),
    FOREIGN KEY (destination_building_id) REFERENCES buildings(id) ON DELETE CASCADE,
    CHECK (mode IN ('vehicle', 'walking')),
    CHECK (direction IN ('entry', 'exit')),
    CHECK (mode = 'walking' OR direction = 'exit'),
    CHECK (JSON_TYPE(steps) = 'ARRAY' AND JSON_LENGTH(steps) <= 200)
);
