USE QueueSmartDB;

-- Clear prior procedures for clean migration
DROP PROCEDURE IF EXISTS MIG_Service;
DROP PROCEDURE IF EXISTS MIG_Queue;
DROP PROCEDURE IF EXISTS MIG_Queue_Entries;
DROP PROCEDURE IF EXISTS Mock_Initialization_Generation;

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