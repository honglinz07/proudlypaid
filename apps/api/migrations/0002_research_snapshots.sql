-- Research snapshots reuse an immutable full repository index. NULL denotes a full snapshot.
ALTER TABLE catalog_snapshots ADD COLUMN index_version TEXT REFERENCES catalog_snapshots(version);
