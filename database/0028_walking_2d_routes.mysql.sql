-- Apply only with owner database authorization to an existing MySQL rehearsal database.
CREATE TABLE IF NOT EXISTS walking_routes (
    destination_building_id INT NOT NULL PRIMARY KEY,
    path_geometry JSON NOT NULL,
    distance_meters INT NOT NULL,
    walk_time_seconds INT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (destination_building_id) REFERENCES buildings(id) ON DELETE CASCADE
);
