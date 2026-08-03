USE QueueSmartDB;

-- Drop existing view if present
DROP VIEW IF EXISTS vw_AdminServiceQueueState;

-- View: vw_AdminServiceQueueState
-- Purpose: Consolidates service profiles with their active queue entries
-- replacing standard front-end looping with optimized database aggregation.
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
        JSON_ARRAYAGG(
            IF(qe.queue_entry_id IS NOT NULL, 
                CONCAT('Person ', qe.position), 
                NULL)
        ), 
        JSON_ARRAY()
    ) AS Queue_Array,
    COUNT(qe.queue_entry_id) AS queue_length
FROM Service s
JOIN Queue q ON s.service_id = q.service_id
JOIN QueueEntry qe ON q.queue_id = qe.queue_id AND qe.status = 'waiting'
GROUP BY 
    s.service_id, 
    s.service_name, 
    s.description, 
    s.expected_duration, 
    s.priority_level, 
    q.status
ORDER BY priority DESC, s.service_id ASC;