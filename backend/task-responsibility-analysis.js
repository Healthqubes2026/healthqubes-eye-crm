const db = require('./src/config/database');

(async () => {
  console.log('🎯 TASK MANAGEMENT RESPONSIBILITY ANALYSIS\n');
  console.log('='.repeat(60));

  // Get employee roles and their task responsibilities
  const [employees] = await db.query(`
    SELECT role, COUNT(*) as count
    FROM employees
    WHERE is_active = 1
    GROUP BY role
    ORDER BY count DESC
  `);

  console.log('👥 EMPLOYEE ROLES & COUNTS:');
  employees.forEach(emp => {
    console.log(`   ${emp.role}: ${emp.count} employees`);
  });

  // Get task creation statistics by role
  const [taskCreators] = await db.query(`
    SELECT e.role, COUNT(t.id) as tasks_created
    FROM tasks t
    JOIN employees e ON t.created_by = e.id
    GROUP BY e.role
    ORDER BY tasks_created DESC
  `);

  console.log('\n📝 TASK CREATION BY ROLE:');
  taskCreators.forEach(tc => {
    console.log(`   ${tc.role}: ${tc.tasks_created} tasks created`);
  });

  // Get task assignment statistics by role
  const [taskAssignees] = await db.query(`
    SELECT e.role, COUNT(t.id) as tasks_assigned
    FROM tasks t
    JOIN employees e ON t.assigned_to = e.id
    GROUP BY e.role
    ORDER BY tasks_assigned DESC
  `);

  console.log('\n🎯 TASK ASSIGNMENT BY ROLE:');
  taskAssignees.forEach(ta => {
    console.log(`   ${ta.role}: ${ta.tasks_assigned} tasks assigned`);
  });

  // Get task status distribution
  const [taskStatuses] = await db.query(`
    SELECT status, COUNT(*) as count
    FROM tasks
    GROUP BY status
    ORDER BY count DESC
  `);

  console.log('\n📊 TASK STATUS DISTRIBUTION:');
  taskStatuses.forEach(ts => {
    console.log(`   ${ts.status}: ${ts.count} tasks`);
  });

  // Get overdue tasks by assignee role
  const [overdueByRole] = await db.query(`
    SELECT e.role, COUNT(t.id) as overdue_count
    FROM tasks t
    JOIN employees e ON t.assigned_to = e.id
    WHERE t.status IN ('pending', 'in_progress')
      AND t.due_date < CURDATE()
    GROUP BY e.role
    ORDER BY overdue_count DESC
  `);

  console.log('\n⏰ OVERDUE TASKS BY ASSIGNEE ROLE:');
  if (overdueByRole.length > 0) {
    overdueByRole.forEach(od => {
      console.log(`   ${od.role}: ${od.overdue_count} overdue tasks`);
    });
  } else {
    console.log('   No overdue tasks found');
  }

  process.exit(0);
})();