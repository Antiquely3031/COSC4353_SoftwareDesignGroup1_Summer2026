USE QueueSmartDB;

-- Clear prior procedures for clean migration
DROP PROCEDURE IF EXISTS MIG_UserCredentials;
DROP PROCEDURE IF EXISTS MIG_UserProfile;
DROP PROCEDURE IF EXISTS MIG_Service;
DROP PROCEDURE IF EXISTS MIG_Queue;
DROP PROCEDURE IF EXISTS MIG_Queue_Entries;
DROP PROCEDURE IF EXISTS Mock_Initialization_Generation;
DROP PROCEDURE IF EXISTS Service_Status_UPDATE;
DROP PROCEDURE IF EXISTS INSERT_Service;
DROP PROCEDURE IF EXISTS UPDATE_Service;
DROP PROCEDURE IF EXISTS DELETE_Service;
DROP PROCEDURE IF EXISTS UPDATE_Queue_Entry;

-- Procedure: Populate User Credentials with mixed and matched names
CREATE PROCEDURE MIG_UserCredentials(IN User_Amount INT)
BEGIN
    DECLARE i INT DEFAULT 1;
    DECLARE first_names TEXT;
    DECLARE last_names TEXT;
    DECLARE current_first VARCHAR(50);
    DECLARE current_last VARCHAR(50);
    DECLARE combined_name VARCHAR(100);
    DECLARE first_index INT;
    DECLARE last_index INT;
    
    -- Seed blocks of raw components
    SET first_names = 'John,Jane,Alex,Emily,Michael,Sarah,David,Jessica,Chris,Ashley,Elvis,Patrick,Kevin,Richard,Maria';
    SET last_names = 'Smith,Johnson,Williams,Brown,Jones,Miller,Davis,Garcia,Rodriguez,Wilson,Martinez,Anderson,Taylor,Thomas,Hernandez';
    
    WHILE i <= User_Amount DO
        -- Use modulo operators to cycle deterministic cross-product selections from the 15-item arrays
        SET first_index = (i % 15) + 1;
        SET last_index = ((i * 3) % 15) + 1;
        
        SET current_first = SUBSTRING_INDEX(SUBSTRING_INDEX(first_names, ',', first_index), ',', -1);
        SET current_last = SUBSTRING_INDEX(SUBSTRING_INDEX(last_names, ',', last_index), ',', -1);
        SET combined_name = CONCAT(current_first, ' ', current_last);
        
        INSERT INTO UserCredentials (name, email, password_hash, role)
        VALUES (
            combined_name,
            CONCAT(LOWER(current_first), '.', LOWER(current_last), i, '@queuesmart.local'),
            CONCAT('hash_fallback_value_', i),
            'User'
        );
        SET i = i + 1;
    END WHILE;
END;

-- Procedure: Populate User Profiles
CREATE PROCEDURE MIG_UserProfile()
BEGIN
    INSERT INTO UserProfile (user_id, preferences)
    SELECT user_id, '{"theme": "dark", "notifications": {"email": true, "sms": false}}'
    FROM UserCredentials;
END;

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

-- Procedure: Populate Entries per Active Queue mapped to random users with dynamic lengths
CREATE PROCEDURE MIG_Queue_Entries(IN Max_Entries_Per_Queue INT)
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE current_queue_id INT;
    DECLARE pos INT;
    DECLARE target_entries INT;
    DECLARE random_user_id INT;

    DECLARE queue_cursor CURSOR FOR SELECT queue_id FROM Queue;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

    OPEN queue_cursor;

    read_loop: LOOP
        FETCH queue_cursor INTO current_queue_id;
        IF done THEN
            LEAVE read_loop;
        END IF;

        -- Generate a random queue depth between 2 and Max_Entries_Per_Queue
        SET target_entries = FLOOR(2 + (RAND() * (Max_Entries_Per_Queue - 2)));
        SET pos = 1;

        WHILE pos <= target_entries DO
            -- Pull a random user from the user pool
            SELECT user_id INTO random_user_id 
            FROM UserCredentials 
            ORDER BY RAND() 
            LIMIT 1;

            INSERT INTO QueueEntry (queue_id, user_id, position, status)
            VALUES (current_queue_id, random_user_id, pos, 'waiting');

            SET pos = pos + 1;
        END WHILE;
    END LOOP;

    CLOSE queue_cursor;
END;

-- Comprehensive Composite Master Procedure
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
        DELETE FROM UserProfile;
        -- Disable constraints temporarily to safely purge base accounts
        SET FOREIGN_KEY_CHECKS = 0;
        DELETE FROM UserCredentials;
        SET FOREIGN_KEY_CHECKS = 1;

        -- Generate dynamic structural dependencies in order
        CALL MIG_UserCredentials(Demo_Amount * 5);
        CALL MIG_UserProfile();
        CALL MIG_Service(Demo_Amount);
        CALL MIG_Queue(Demo_Amount);
        CALL MIG_Queue_Entries(Demo_Amount * 2);
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

CREATE PROCEDURE DELETE_Service(IN targeted_service_id INT)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;
        DELETE FROM Service WHERE service_id = targeted_service_id;
    COMMIT;
END;

-- Admin Queue Management Transactions
CREATE PROCEDURE UPDATE_Queue_Entry
(
    IN targeted_queue_entry_id INT,
    IN targeted_position INT,
    IN targeted_status ENUM('waiting', 'served', 'canceled')
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;
        UPDATE QueueEntry
        SET position = targeted_position, status = COALESCE(targeted_status, 'waiting')
        WHERE queue_entry_id = targeted_queue_entry_id;
    COMMIT;
END