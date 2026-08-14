USE QueueSmartDB;

DROP VIEW IF EXISTS ReturnTwoParts;
DROP VIEW IF EXISTS AllServicesStats;
DROP VIEW IF EXISTS OverallStats;
DROP VIEW IF EXISTS vw_AdminServiceQueueState;
DROP PROCEDURE IF EXISTS GetAdminReportStats;

CREATE VIEW vw_AdminServiceQueueState AS
SELECT 
    s.service_id,
    s.service_name AS name,
    s.description,
    s.expected_duration,
    CASE s.priority_level
        WHEN 'Low' THEN 1
        WHEN 'Medium' THEN 2
        WHEN 'High' THEN 3
        ELSE 1
    END AS priority,
    COALESCE(q.status, 'closed') AS operation_status,
    COALESCE(
        (
            SELECT JSON_ARRAYAGG(
                JSON_OBJECT(
                    'queue_entry_id', t.queue_entry_id,
                    'user_id', t.user_id,
                    'user_name', t.user_name,
                    'position', t.position,
                    'line_status', t.line_status,
                    'join_time', t.join_time
                )
            )
            FROM (
                SELECT 
                    qe.queue_id,
                    qe.queue_entry_id,
                    qe.user_id,
                    u.name AS user_name,
                    qe.position,
                    qe.status AS line_status,
                    qe.join_time
                FROM QueueEntry qe
                JOIN UserCredentials u ON qe.user_id = u.user_id
                WHERE qe.status = 'waiting'
                ORDER BY qe.position ASC
                LIMIT 18446744073709551615
            ) t
            WHERE t.queue_id = q.queue_id
        ),
        JSON_ARRAY()
    ) AS Queue_Array,
    (
        SELECT COUNT(*) 
        FROM QueueEntry qe 
        WHERE qe.queue_id = q.queue_id AND qe.status = 'waiting'
    ) AS queue_length
FROM Service s
JOIN Queue q ON s.service_id = q.service_id
ORDER BY priority DESC, s.service_id ASC;

CREATE VIEW OverallStats AS
SELECT
    COUNT(DISTINCT qe.queue_entry_id) AS total_queue_entries,
    COUNT(DISTINCT qe.user_id) AS total_unique_users,
    SUM(CASE WHEN qe.status = 'served' THEN 1 ELSE 0 END) AS total_users_served,
    SUM(CASE WHEN qe.status = 'canceled' THEN 1 ELSE 0 END) AS total_users_canceled,
    COALESCE(AVG(CASE WHEN qe.status = 'served' THEN TIMESTAMPDIFF(MINUTE, qe.join_time, COALESCE(qe.served_time, NOW())) ELSE NULL END), 0) AS average_wait_time_minutes
FROM QueueEntry qe;

CREATE VIEW AllServicesStats AS
SELECT
    s.service_id,
    s.service_name,
    s.description,
    s.expected_duration,
    s.priority_level,
    COUNT(qe.queue_entry_id) AS total_service_entries,
    SUM(CASE WHEN qe.status = 'served' THEN 1 ELSE 0 END) AS users_served,
    SUM(CASE WHEN qe.status = 'waiting' THEN 1 ELSE 0 END) AS users_waiting,
    SUM(CASE WHEN qe.status = 'canceled' THEN 1 ELSE 0 END) AS users_canceled,
    COALESCE(AVG(CASE WHEN qe.status = 'served' THEN TIMESTAMPDIFF(MINUTE, qe.join_time, COALESCE(qe.served_time, NOW())) ELSE NULL END), 0) AS avg_service_wait_time_minutes
FROM Service s
LEFT JOIN Queue q ON s.service_id = q.service_id
LEFT JOIN QueueEntry qe ON q.queue_id = qe.queue_id
GROUP BY s.service_id, s.service_name, s.description, s.expected_duration, s.priority_level;

CREATE VIEW ReturnTwoParts AS
SELECT 
    'Overall' AS stat_type,
    NULL AS service_id,
    'System Wide' AS name,
    o.total_queue_entries,
    o.total_unique_users,
    o.total_users_served,
    o.total_users_canceled,
    o.average_wait_time_minutes
FROM OverallStats o
UNION ALL
SELECT 
    'Service' AS stat_type,
    a.service_id,
    a.service_name AS name,
    a.total_service_entries AS total_queue_entries,
    a.users_waiting AS total_unique_users,
    a.users_served AS total_users_served,
    a.users_canceled AS total_users_canceled,
    a.avg_service_wait_time_minutes AS average_wait_time_minutes
FROM AllServicesStats a;

CREATE PROCEDURE GetAdminReportStats(IN p_start_date DATETIME)
BEGIN
    -- 1. Overall System Stats
    SELECT 
        COUNT(DISTINCT qe.queue_entry_id) AS total_queue_entries,
        COUNT(DISTINCT qe.user_id) AS total_unique_users,
        SUM(CASE WHEN qe.status = 'served' THEN 1 ELSE 0 END) AS total_users_served,
        SUM(CASE WHEN qe.status = 'canceled' THEN 1 ELSE 0 END) AS total_users_canceled,
        COALESCE(AVG(CASE WHEN qe.status = 'served' THEN TIMESTAMPDIFF(MINUTE, qe.join_time, COALESCE(qe.served_time, NOW())) ELSE NULL END), 0) AS average_wait_time_minutes
    FROM QueueEntry qe 
    WHERE qe.join_time >= p_start_date;

    -- 2. Services Stats (including Description, Expected Duration, and Priority Level)
    SELECT 
        s.service_id,
        s.service_name,
        s.description,
        s.expected_duration,
        s.priority_level,
        COUNT(qe.queue_entry_id) AS total_service_entries,
        SUM(CASE WHEN qe.status = 'served' THEN 1 ELSE 0 END) AS users_served,
        SUM(CASE WHEN qe.status = 'waiting' THEN 1 ELSE 0 END) AS users_waiting,
        SUM(CASE WHEN qe.status = 'canceled' THEN 1 ELSE 0 END) AS users_canceled,
        COALESCE(AVG(CASE WHEN qe.status = 'served' THEN TIMESTAMPDIFF(MINUTE, qe.join_time, COALESCE(qe.served_time, NOW())) ELSE NULL END), 0) AS avg_service_wait_time_minutes
    FROM Service s
    LEFT JOIN Queue q ON s.service_id = q.service_id
    LEFT JOIN QueueEntry qe ON q.queue_id = qe.queue_id AND qe.join_time >= p_start_date
    GROUP BY s.service_id, s.service_name, s.description, s.expected_duration, s.priority_level;

    -- 3. User History Stats
    SELECT 
        qe.queue_entry_id,
        qe.user_id,
        u.name AS user_name,
        s.service_name,
        qe.status,
        qe.join_time,
        qe.served_time
    FROM QueueEntry qe
    JOIN UserCredentials u ON qe.user_id = u.user_id
    JOIN Queue q ON qe.queue_id = q.queue_id
    JOIN Service s ON q.service_id = s.service_id
    WHERE qe.join_time >= p_start_date
    ORDER BY qe.join_time DESC;
END;