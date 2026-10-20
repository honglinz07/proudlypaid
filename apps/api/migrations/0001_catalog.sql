CREATE TABLE catalog_snapshots (
  version TEXT PRIMARY KEY,
  reviewed_on TEXT NOT NULL,
  project_count INTEGER NOT NULL,
  collection_scope TEXT NOT NULL CHECK(collection_scope IN ('curated-only', 'local-github-index'))
);
CREATE TABLE catalog_state (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  version TEXT NOT NULL REFERENCES catalog_snapshots(version)
);
CREATE TABLE projects (
  version TEXT NOT NULL REFERENCES catalog_snapshots(version),
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  repository TEXT NOT NULL,
  category TEXT,
  license_json TEXT CHECK(license_json IS NULL OR json_valid(license_json)),
  reviewed_on TEXT,
  terms TEXT NOT NULL,
  PRIMARY KEY(version, id)
);
CREATE TABLE project_terms (
  version TEXT NOT NULL,
  term TEXT NOT NULL,
  project_id TEXT NOT NULL,
  PRIMARY KEY(version, term, project_id),
  FOREIGN KEY(version, project_id) REFERENCES projects(version, id)
);
CREATE VIRTUAL TABLE project_search USING fts5(terms, content='projects', content_rowid='rowid', tokenize='trigram');
CREATE TRIGGER projects_insert AFTER INSERT ON projects BEGIN
  INSERT INTO project_search(rowid, terms) VALUES (new.rowid, new.terms);
END;
CREATE TRIGGER projects_delete AFTER DELETE ON projects BEGIN
  INSERT INTO project_search(project_search, rowid, terms) VALUES ('delete', old.rowid, old.terms);
END;
CREATE TABLE products (
  version TEXT NOT NULL REFERENCES catalog_snapshots(version),
  id TEXT NOT NULL,
  verification TEXT NOT NULL CHECK(verification IN ('official-reviewed', 'needs-review')),
  data_json TEXT NOT NULL CHECK(json_valid(data_json)),
  PRIMARY KEY(version, id)
);
CREATE TABLE relationships (
  version TEXT NOT NULL,
  project_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  data_json TEXT NOT NULL CHECK(json_valid(data_json)),
  PRIMARY KEY(version, project_id, product_id),
  FOREIGN KEY(version, project_id) REFERENCES projects(version, id),
  FOREIGN KEY(version, product_id) REFERENCES products(version, id)
);
