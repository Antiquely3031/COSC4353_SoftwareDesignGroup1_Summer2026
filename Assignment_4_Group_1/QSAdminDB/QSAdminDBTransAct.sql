USE QueueSmartDB;

-- Clear prior procedures for clean migration
DROP PROCEDURE IF EXISTS MIG_Service;
DROP PROCEDURE IF EXISTS MIG_Queue;
DROP PROCEDURE IF EXISTS MIG_Queue_Entries;
DROP PROCEDURE IF EXISTS Mock_Initialization_Generation;
DROP PROCEDURE IF EXISTS Service_Status_UPDATE;
DROP PROCEDURE IF EXISTS INSERT_Service;
DROP PROCEDURE IF EXISTS UPDATE_Service;
DROP PROCEDURE IF EXISTS DELETE_Service;

-- Mock Data Generation
-- Procedure: Populate Services
CREATE PROCEDURE MIG_Service(IN Demo_Amount INT)
BEGIN
    DECLARE i INT DEFAULT 1;
    DECLARE p_level ENUM('Low', 'Medium', 'High');
    
    WHILE i <= Demo_Amount DO
        IF (i % 4 = 3) THEN
            SET p_level = 'High';
        ELSEIF (i % 4 = 2) THEN
            SET p_level = 'Medium';
        ELSE
            SET p_level = 'Low';
        END IF;

        INSERT INTO Service (service_name, description, expected_duration, priority_level)
        VALUES (
            CONCAT('Placeholder ', i),
            CONCAT('According to all known laws of aviation, there is no way that a bee should be able to fly. ', i),
            i,
            p_level
        );
        SET i = i + 1;
    END WHILE;
END;

-- Procedure: Populate Queues per Service
CREATE PROCEDURE MIG_Queue(IN Demo_Amount INT)
BEGIN
    INSERT INTO Queue (service_id, status)
    SELECT service_id, 'open'
    FROM Service
    LIMIT Demo_Amount;
END;

-- Procedure: Populate Entries per Active Queue
CREATE PROCEDURE MIG_Queue_Entries(IN Entries_Per_Queue INT)
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE current_queue_id INT;
    DECLARE pos INT;
    DECLARE demo_user_id INT;

    DECLARE queue_cursor CURSOR FOR SELECT queue_id FROM Queue;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

    IF NOT EXISTS (SELECT 1 FROM UserCredentials WHERE user_id = 1) THEN
        INSERT INTO UserCredentials (user_id, name, email, password_hash, role)
        VALUES (1, 'System Seed User', 'seed@queuesmart.local', 'hash_placeholder', 'User');
    END IF;
    SELECT user_id INTO demo_user_id FROM UserCredentials LIMIT 1;

    OPEN queue_cursor;

    read_loop: LOOP
        FETCH queue_cursor INTO current_queue_id;
        IF done THEN
            LEAVE read_loop;
        END IF;

        SET pos = 1;
        WHILE pos <= Entries_Per_Queue DO
            INSERT INTO QueueEntry (queue_id, user_id, position, status)
            VALUES (current_queue_id, demo_user_id, pos, 'waiting');
            SET pos = pos + 1;
        END WHILE;
    END LOOP;

    CLOSE queue_cursor;
END;

-- Orchestration Procedure
CREATE PROCEDURE Mock_Initialization_Generation(IN Demo_Amount INT)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;
        DELETE FROM QueueEntry;
        DELETE FROM Queue;
        DELETE FROM Service;

        CALL MIG_Service(Demo_Amount);
        CALL MIG_Queue(Demo_Amount);
        CALL MIG_Queue_Entries(60);
    COMMIT;
END;

-- Admin Dashboard Status Update
CREATE PROCEDURE Service_Status_UPDATE(IN Service_NUM INT, IN Status_Val VARCHAR(10))
BEGIN
    DECLARE formatted_status VARCHAR(10);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    -- Normalize status string to match DB ENUM('open', 'closed')
    IF LOWER(TRIM(Status_Val)) IN ('close', 'closed') THEN
        SET formatted_status = 'closed';
    ELSE
        SET formatted_status = 'open';
    END IF;

    START TRANSACTION;
        UPDATE Queue 
        SET status = formatted_status 
        WHERE service_id = Service_NUM;
    COMMIT;
END;

-- Admin Service Management Transactions
CREATE PROCEDURE INSERT_Service
(
    IN p_service_name VARCHAR(100),
    IN p_description VARCHAR(255),
    IN p_expected_duration INT,
    IN p_priority_level ENUM('Low', 'Medium', 'High')
)
BEGIN
    DECLARE new_service_id INT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;
        INSERT INTO Service (service_name, description, expected_duration, priority_level)
        VALUES (p_service_name, p_description, p_expected_duration, COALESCE(p_priority_level, 'Medium'));

        SET new_service_id = LAST_INSERT_ID();

        INSERT INTO Queue (service_id, status)
        VALUES (new_service_id, 'open');

        -- Return generated ID directly to caller
        SELECT new_service_id AS generated_id;
    COMMIT;
END;

CREATE PROCEDURE UPDATE_Service
(
    IN p_service_id INT,
    IN p_service_name VARCHAR(100),
    IN p_description VARCHAR(255),
    IN p_expected_duration INT,
    IN p_priority_level ENUM('Low', 'Medium', 'High')
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;
        UPDATE Service
        SET service_name = p_service_name,
            description = p_description,
            expected_duration = p_expected_duration,
            priority_level = COALESCE(p_priority_level, 'Medium')
        WHERE service_id = p_service_id;
    COMMIT;
END;

CREATE PROCEDURE DELETE_Service(IN p_service_id INT)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;
        DELETE FROM Service 
        WHERE service_id = p_service_id;
    COMMIT;
END;