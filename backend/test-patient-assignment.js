require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const db = require('./src/config/database');

async function testPatientAssignment() {
  try {
    console.log('🧪 Testing Patient Assignment Workflow...\n');

    // 1. Check if assignment columns exist
    console.log('📋 Step 1: Verifying assignment columns exist in patients table...');
    const [columns] = await db.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'patients'
        AND COLUMN_NAME IN ('assigned_hospital_id', 'assigned_doctor_id', 'hospital_assigned_at', 'doctor_assigned_at')
      ORDER BY ORDINAL_POSITION
    `);

    if (columns.length === 0) {
      console.error('❌ Assignment columns not found!');
      process.exit(1);
    }

    console.log('✅ Assignment columns found:');
    columns.forEach(col => {
      console.log(`   - ${col.COLUMN_NAME}: ${col.COLUMN_TYPE} (nullable: ${col.IS_NULLABLE})`);
    });

    // 2. Check foreign key constraints
    console.log('\n📋 Step 2: Verifying foreign key constraints...');
    const [fks] = await db.query(`
      SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'patients'
        AND CONSTRAINT_NAME LIKE 'fk_patients_%'
    `);

    if (fks.length === 0) {
      console.error('⚠️  No foreign key constraints found for patient assignments');
    } else {
      console.log('✅ Foreign key constraints found:');
      fks.forEach(fk => {
        console.log(`   - ${fk.CONSTRAINT_NAME}: ${fk.COLUMN_NAME} → ${fk.REFERENCED_TABLE_NAME}(${fk.REFERENCED_COLUMN_NAME})`);
      });
    }

    // 3. Check patient_assignments table
    console.log('\n📋 Step 3: Verifying patient_assignments table...');
    const [assignTable] = await db.query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'patient_assignments'
    `);

    if (assignTable.length === 0) {
      console.error('❌ patient_assignments table not found!');
      process.exit(1);
    }
    console.log('✅ patient_assignments table exists');

    // 4. Get first patient to test with
    console.log('\n📋 Step 4: Finding test patient...');
    const [patients] = await db.query('SELECT id, patient_name FROM patients LIMIT 1');

    if (patients.length === 0) {
      console.log('⚠️  No patients found in database. Create a test patient first.');
      process.exit(0);
    }

    const testPatientId = patients[0].id;
    console.log(`✅ Test patient found: ID=${testPatientId}, Name=${patients[0].patient_name}`);

    // 5. Get available hospitals and doctors
    console.log('\n📋 Step 5: Finding test hospital and doctor...');
    const [hospitals] = await db.query('SELECT id, name FROM hospitals LIMIT 1');
    const [doctors] = await db.query('SELECT id, name FROM doctors LIMIT 1');

    if (hospitals.length === 0 || doctors.length === 0) {
      console.log('⚠️  No hospitals or doctors found. Create test data first.');
      process.exit(0);
    }

    const testHospitalId = hospitals[0].id;
    const testDoctorId = doctors[0].id;
    console.log(`✅ Test hospital: ID=${testHospitalId}, Name=${hospitals[0].name}`);
    console.log(`✅ Test doctor: ID=${testDoctorId}, Name=${doctors[0].name}`);

    // 6. Test assignment update
    console.log('\n📋 Step 6: Testing patient assignment...');
    const assignQuery = `
      UPDATE patients
      SET assigned_hospital_id = ?, hospital_assigned_at = NOW(),
          assigned_doctor_id = ?, doctor_assigned_at = NOW()
      WHERE id = ?
    `;
    await db.query(assignQuery, [testHospitalId, testDoctorId, testPatientId]);
    console.log('✅ Assignment query executed successfully');

    // 7. Verify assignment was saved
    console.log('\n📋 Step 7: Verifying assignment was saved...');
    const [updatedPatient] = await db.query(
      'SELECT id, assigned_hospital_id, assigned_doctor_id, hospital_assigned_at, doctor_assigned_at FROM patients WHERE id = ?',
      [testPatientId]
    );

    if (updatedPatient.length === 0) {
      console.error('❌ Patient not found after assignment!');
      process.exit(1);
    }

    const pat = updatedPatient[0];
    console.log('✅ Assignment saved:');
    console.log(`   - assigned_hospital_id: ${pat.assigned_hospital_id} (expected: ${testHospitalId})`);
    console.log(`   - assigned_doctor_id: ${pat.assigned_doctor_id} (expected: ${testDoctorId})`);
    console.log(`   - hospital_assigned_at: ${pat.hospital_assigned_at}`);
    console.log(`   - doctor_assigned_at: ${pat.doctor_assigned_at}`);

    if (pat.assigned_hospital_id !== testHospitalId || pat.assigned_doctor_id !== testDoctorId) {
      console.error('❌ Assignment values do not match!');
      process.exit(1);
    }

    // 8. Test patient_assignments history table
    console.log('\n📋 Step 8: Testing assignment history recording...');
    const [employees] = await db.query('SELECT id FROM employees LIMIT 1');
    if (employees.length === 0) {
      console.log('⚠️  No employees found for assignment history test');
    } else {
      const employeeId = employees[0].id;
      await db.query(
        `INSERT INTO patient_assignments (patient_id, hospital_id, doctor_id, assigned_by, assignment_type, status)
         VALUES (?, ?, ?, ?, 'both', 'active')`,
        [testPatientId, testHospitalId, testDoctorId, employeeId]
      );
      console.log('✅ Assignment history recorded successfully');

      const [history] = await db.query(
        'SELECT id, patient_id, hospital_id, doctor_id FROM patient_assignments WHERE patient_id = ? ORDER BY created_at DESC LIMIT 1',
        [testPatientId]
      );
      if (history.length > 0) {
        console.log(`   - History record ID: ${history[0].id}`);
        console.log(`   - Patient ID: ${history[0].patient_id}`);
        console.log(`   - Hospital ID: ${history[0].hospital_id}`);
        console.log(`   - Doctor ID: ${history[0].doctor_id}`);
      }
    }

    // 9. Test JOIN with assignment data
    console.log('\n📋 Step 9: Testing patient retrieval with assignment data...');
    const [joinResults] = await db.query(`
      SELECT p.id, p.patient_name, p.assigned_hospital_id, h.name as hospital_name,
             p.assigned_doctor_id, d.name as doctor_name
      FROM patients p
      LEFT JOIN hospitals h ON p.assigned_hospital_id = h.id
      LEFT JOIN doctors d ON p.assigned_doctor_id = d.id
      WHERE p.id = ?
    `, [testPatientId]);

    if (joinResults.length > 0) {
      const result = joinResults[0];
      console.log('✅ Patient retrieved with assignment data:');
      console.log(`   - Patient: ${result.patient_name}`);
      console.log(`   - Hospital: ${result.hospital_name || 'N/A'}`);
      console.log(`   - Doctor: ${result.doctor_name || 'N/A'}`);
    }

    console.log('\n✅ All tests passed! Patient assignment schema is working correctly.\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testPatientAssignment();
