USE QueueSmartDB;

-- Drop existing view if present
DROP VIEW IF EXISTS vw_AdminServiceQueueState;

-- View: vw_AdminServiceQueueState
-- Purpose: Consolidates service profiles with their active queue entries mapping rich objects
-- and guarantees proper position sorting via a localized sorted subquery optimization barrier.
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
                    'user_name', CONCAT('Person ', t.queue_entry_id),
                    'position', t.position,
                    'line_status', t.status,
                    'join_time', t.join_time
                )
            )
            FROM (
                SELECT * FROM QueueEntry 
                WHERE status = 'waiting' 
                ORDER BY position ASC
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