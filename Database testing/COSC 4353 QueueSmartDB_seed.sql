USE QueueSmartDB;

INSERT INTO Service (service_name, description, expected_duration, priority_level)
VALUES
('Advising Academics', 'Academic advising support for students.', 18, 'Medium'),
('Welfare Check', 'Student wellness and support service.', 46, 'High'),
('IT Help Desk', 'Technical support for account or device issues.', 12, 'Low'),
('Financial Aid', 'Financial aid and payment assistance.', 25, 'Medium');

INSERT INTO `Queue` (service_id, status)
VALUES
(1, 'open'),
(2, 'open'),
(3, 'open'),
(4, 'open');