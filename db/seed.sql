-- Seed minimal: crée un projet de démonstration pour un utilisateur existant.
-- Remplacer @user_id par un ID réel de users.id (créé après register/login).
SET @user_id = 1;

INSERT INTO projects(name, description, created_by)
VALUES ('Projet Démo TNR', 'Projet de démarrage', @user_id);

SET @project_id = LAST_INSERT_ID();

INSERT INTO project_members(project_id, user_id, role)
VALUES (@project_id, @user_id, 'admin');

INSERT INTO releases(project_id, version, notes, created_by)
VALUES (@project_id, 'v1.0.0', 'Release initiale', @user_id);

INSERT INTO test_cases(project_id, title, steps, expected_result, created_by)
VALUES
(@project_id, 'Login utilisateur', '1. Ouvrir /\n2. Saisir email/mdp\n3. Cliquer Login', 'Session ouverte', @user_id),
(@project_id, 'Création projet', '1. Aller sur Projects\n2. Créer un projet', 'Projet créé', @user_id);
