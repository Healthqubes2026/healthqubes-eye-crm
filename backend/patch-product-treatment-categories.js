const db = require('./src/config/database');

async function patchProductTreatmentCategories() {
  try {
    console.log('🔧 Patching product treatment categories...\n');

    // 1. Add hospital_type column to treatment_categories if it doesn't exist
    try {
      await db.query(`
        ALTER TABLE treatment_categories ADD COLUMN hospital_type VARCHAR(100) NULL DEFAULT 'Eye Hospital'
      `);
      console.log('  ✅ hospital_type column added to treatment_categories');
    } catch(e) {
      if (e.message.includes('Duplicate column')) {
        console.log('  ℹ️  hospital_type column already exists');
      } else {
        console.log('  ⚠️  Could not add hospital_type:', e.message);
      }
    }

    // 2. Add treatment_category_id to products table
    try {
      await db.query(`
        ALTER TABLE products ADD COLUMN treatment_category_id INT NULL
      `);
      console.log('  ✅ treatment_category_id column added to products');
    } catch(e) {
      if (e.message.includes('Duplicate column')) {
        console.log('  ℹ️  treatment_category_id column already exists');
      } else {
        console.log('  ⚠️  Could not add treatment_category_id:', e.message);
      }
    }

    // 3. Add hospital field to products table
    try {
      await db.query(`
        ALTER TABLE products ADD COLUMN hospital VARCHAR(150) NULL
      `);
      console.log('  ✅ hospital column added to products');
    } catch(e) {
      if (e.message.includes('Duplicate column')) {
        console.log('  ℹ️  hospital column already exists');
      } else {
        console.log('  ⚠️  Could not add hospital:', e.message);
      }
    }

    // 4. Add foreign key constraint
    try {
      await db.query(`
        ALTER TABLE products ADD CONSTRAINT fk_treatment_category 
        FOREIGN KEY (treatment_category_id) REFERENCES treatment_categories(id) ON DELETE SET NULL
      `);
      console.log('  ✅ foreign key constraint added');
    } catch(e) {
      if (e.message.includes('Duplicate key') || e.message.includes('already exists')) {
        console.log('  ℹ️  foreign key constraint already exists');
      } else {
        console.log('  ⚠️  Could not add constraint:', e.message);
      }
    }

    // 5. Insert default treatment categories with hospital_type
    const defaultCategories = [
      { name: 'Cataract Surgery', hospital_type: 'Eye Hospital', description: 'Cataract surgery related treatments and equipment', category_type: 'surgery' },
      { name: 'Retina Treatment', hospital_type: 'Eye Hospital', description: 'Retinal conditions treatment and procedures', category_type: 'treatment' },
      { name: 'Glaucoma Management', hospital_type: 'Eye Hospital', description: 'Glaucoma treatment options', category_type: 'treatment' },
      { name: 'Laser Procedures', hospital_type: 'Eye Hospital', description: 'Laser-based eye treatments', category_type: 'surgery' },
      { name: 'Corneal Surgery', hospital_type: 'Eye Hospital', description: 'Cornea-related surgical procedures', category_type: 'surgery' },
      { name: 'Orthoptic Training', hospital_type: 'Eye Hospital', description: 'Eye coordination and vision training', category_type: 'treatment' },
      { name: 'IOL Lenses', hospital_type: 'Eye Hospital', description: 'Intraocular lens implants', category_type: 'diagnostic' },
      { name: 'Eye Drops & Medications', hospital_type: 'Eye Hospital', description: 'Pharmaceutical products for eye care', category_type: 'treatment' },
      { name: 'Diagnostic Equipment', hospital_type: 'Eye Hospital', description: 'Equipment for eye examination and diagnosis', category_type: 'diagnostic' },
    ];

    let insertedCount = 0;
    for (const cat of defaultCategories) {
      try {
        const [result] = await db.query(
          `INSERT IGNORE INTO treatment_categories (name, description, category_type, hospital_type) VALUES (?,?,?,?)`,
          [cat.name, cat.description, cat.category_type, cat.hospital_type]
        );
        if (result.affectedRows > 0) insertedCount++;
      } catch(e) {
        console.log(`  ⚠️  Could not insert category ${cat.name}:`, e.message);
      }
    }
    console.log(`  ✅ ${insertedCount}/${defaultCategories.length} default treatment categories processed`);

    console.log('\n✅ Product treatment categories patch completed successfully!\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

patchProductTreatmentCategories();
