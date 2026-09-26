const db = require('./src/config/database');

const sampleHospitals = [
  {
    name: 'Apollo Hospitals Chennai',
    address: '21 Greams Lane, Off Greams Road, Thousand Lights, Chennai, Tamil Nadu 600006',
    city: 'Chennai',
    state: 'Tamil Nadu',
    country: 'India',
    phone: '+91-44-28290200',
    email: 'info@apollohospitals.com',
    website: 'https://www.apollohospitals.com',
    lat: 13.0827,
    lng: 80.2707,
    specialties: JSON.stringify(['Cardiology', 'Neurology', 'Oncology', 'Orthopedics']),
    category: 'tertiary',
    accreditation: 'JCI',
    emergency_services: true,
    international_patient_services: true
  },
  {
    name: 'Max Super Speciality Hospital',
    address: 'FC-50, C & D Block, Shalimar Bagh, New Delhi, Delhi 110088',
    city: 'New Delhi',
    state: 'Delhi',
    country: 'India',
    phone: '+91-11-66422222',
    email: 'info@maxhealthcare.com',
    website: 'https://www.maxhealthcare.in',
    lat: 28.7176,
    lng: 77.1637,
    specialties: JSON.stringify(['Cardiology', 'Oncology', 'Nephrology', 'Urology']),
    category: 'super_specialty',
    accreditation: 'NABH',
    emergency_services: true,
    international_patient_services: true
  },
  {
    name: 'Fortis Hospital Mumbai',
    address: 'Mulund Goregaon Link Road, Mulund (West), Mumbai, Maharashtra 400078',
    city: 'Mumbai',
    state: 'Maharashtra',
    country: 'India',
    phone: '+91-22-43654365',
    email: 'info@fortishealthcare.com',
    website: 'https://www.fortishealthcare.com',
    lat: 19.1619,
    lng: 72.8567,
    specialties: JSON.stringify(['Cardiology', 'Neurology', 'Gastroenterology', 'Pulmonology']),
    category: 'tertiary',
    accreditation: 'JCI',
    emergency_services: true,
    international_patient_services: true
  },
  {
    name: 'Manipal Hospital Bangalore',
    address: '98, HAL Airport Road, Bangalore, Karnataka 560017',
    city: 'Bangalore',
    state: 'Karnataka',
    country: 'India',
    phone: '+91-80-25024444',
    email: 'info@manipalhospitals.com',
    website: 'https://www.manipalhospitals.com',
    lat: 12.9716,
    lng: 77.5946,
    specialties: JSON.stringify(['Oncology', 'Cardiology', 'Neurology', 'Orthopedics']),
    category: 'tertiary',
    accreditation: 'NABH',
    emergency_services: true,
    international_patient_services: true
  },
  {
    name: 'Medanta The Medicity',
    address: 'CH Baktawar Singh Road, Sector 38, Gurugram, Haryana 122001',
    city: 'Gurugram',
    state: 'Haryana',
    country: 'India',
    phone: '+91-124-4141414',
    email: 'info@medanta.org',
    website: 'https://www.medanta.org',
    lat: 28.4391,
    lng: 77.0406,
    specialties: JSON.stringify(['Cardiology', 'Oncology', 'Neurology', 'Liver Transplant']),
    category: 'super_specialty',
    accreditation: 'JCI',
    emergency_services: true,
    international_patient_services: true
  }
];

const sampleDoctors = [
  {
    name: 'Dr. Rajesh Kumar',
    specialization: 'Cardiology',
    hospital: 'Apollo Hospitals Chennai',
    address: '21 Greams Lane, Off Greams Road, Thousand Lights, Chennai',
    city: 'Chennai',
    state: 'Tamil Nadu',
    phone: '+91-9876543210',
    email: 'rajesh.kumar@apollohospitals.com',
    lat: 13.0827,
    lng: 80.2707,
    category: 'A'
  },
  {
    name: 'Dr. Priya Sharma',
    specialization: 'Neurology',
    hospital: 'Max Super Speciality Hospital',
    address: 'FC-50, C & D Block, Shalimar Bagh, New Delhi',
    city: 'New Delhi',
    state: 'Delhi',
    phone: '+91-9876543211',
    email: 'priya.sharma@maxhealthcare.com',
    lat: 28.7176,
    lng: 77.1637,
    category: 'A'
  },
  {
    name: 'Dr. Amit Patel',
    specialization: 'Orthopedics',
    hospital: 'Fortis Hospital Mumbai',
    address: 'Mulund Goregaon Link Road, Mulund (West), Mumbai',
    city: 'Mumbai',
    state: 'Maharashtra',
    phone: '+91-9876543212',
    email: 'amit.patel@fortishealthcare.com',
    lat: 19.1619,
    lng: 72.8567,
    category: 'B'
  },
  {
    name: 'Dr. Sunita Reddy',
    specialization: 'Oncology',
    hospital: 'Apollo Hospitals Chennai',
    address: '21 Greams Lane, Off Greams Road, Thousand Lights, Chennai',
    city: 'Chennai',
    state: 'Tamil Nadu',
    phone: '+91-9876543213',
    email: 'sunita.reddy@apollohospitals.com',
    lat: 13.0827,
    lng: 80.2707,
    category: 'A'
  },
  {
    name: 'Dr. Vikram Singh',
    specialization: 'Nephrology',
    hospital: 'Max Super Speciality Hospital',
    address: 'FC-50, C & D Block, Shalimar Bagh, New Delhi',
    city: 'New Delhi',
    state: 'Delhi',
    phone: '+91-9876543214',
    email: 'vikram.singh@maxhealthcare.com',
    lat: 28.7176,
    lng: 77.1637,
    category: 'B'
  },
  {
    name: 'Dr. Meera Joshi',
    specialization: 'Gastroenterology',
    hospital: 'Fortis Hospital Mumbai',
    address: 'Mulund Goregaon Link Road, Mulund (West), Mumbai',
    city: 'Mumbai',
    state: 'Maharashtra',
    phone: '+91-9876543215',
    email: 'meera.joshi@fortishealthcare.com',
    lat: 19.1619,
    lng: 72.8567,
    category: 'B'
  },
  {
    name: 'Dr. Arjun Rao',
    specialization: 'Pulmonology',
    hospital: 'Manipal Hospital Bangalore',
    address: '98, HAL Airport Road, Bangalore',
    city: 'Bangalore',
    state: 'Karnataka',
    phone: '+91-9876543216',
    email: 'arjun.rao@manipalhospitals.com',
    lat: 12.9716,
    lng: 77.5946,
    category: 'B'
  },
  {
    name: 'Dr. Kavita Gupta',
    specialization: 'Dermatology',
    hospital: 'Medanta The Medicity',
    address: 'CH Baktawar Singh Road, Sector 38, Gurugram',
    city: 'Gurugram',
    state: 'Haryana',
    phone: '+91-9876543217',
    email: 'kavita.gupta@medanta.org',
    lat: 28.4391,
    lng: 77.0406,
    category: 'C'
  },
  {
    name: 'Dr. Ramesh Iyer',
    specialization: 'Urology',
    hospital: 'Apollo Hospitals Chennai',
    address: '21 Greams Lane, Off Greams Road, Thousand Lights, Chennai',
    city: 'Chennai',
    state: 'Tamil Nadu',
    phone: '+91-9876543218',
    email: 'ramesh.iyer@apollohospitals.com',
    lat: 13.0827,
    lng: 80.2707,
    category: 'B'
  },
  {
    name: 'Dr. Anjali Desai',
    specialization: 'Pediatrics',
    hospital: 'Max Super Speciality Hospital',
    address: 'FC-50, C & D Block, Shalimar Bagh, New Delhi',
    city: 'New Delhi',
    state: 'Delhi',
    phone: '+91-9876543219',
    email: 'anjali.desai@maxhealthcare.com',
    lat: 28.7176,
    lng: 77.1637,
    category: 'C'
  }
];

async function seedHospitalDoctorData() {
  try {
    console.log('Starting hospital and doctor data seeding...');

    // Insert hospitals
    console.log('Inserting hospitals...');
    for (const hospital of sampleHospitals) {
      await db.query(
        `INSERT INTO hospitals
         (name, address, city, state, country, phone, email, website,
          lat, lng, specialties, category, accreditation, emergency_services, international_patient_services, added_by, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)`,
        [
          hospital.name, hospital.address, hospital.city, hospital.state, hospital.country,
          hospital.phone, hospital.email, hospital.website, hospital.lat, hospital.lng,
          hospital.specialties, hospital.category, hospital.accreditation,
          hospital.emergency_services, hospital.international_patient_services
        ]
      );
    }
    console.log('✅ Hospitals inserted successfully');

    // Insert doctors
    console.log('Inserting doctors...');
    for (const doctor of sampleDoctors) {
      await db.query(
        `INSERT INTO doctors
         (name, specialization, hospital, address, city, state, phone, email, lat, lng, category, added_by, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)`,
        [
          doctor.name, doctor.specialization, doctor.hospital, doctor.address,
          doctor.city, doctor.state, doctor.phone, doctor.email, doctor.lat,
          doctor.lng, doctor.category
        ]
      );
    }
    console.log('✅ Doctors inserted successfully');

    // Verify the data
    const [hospitalCount] = await db.query('SELECT COUNT(*) as count FROM hospitals');
    const [doctorCount] = await db.query('SELECT COUNT(*) as count FROM doctors');

    console.log(`\n📊 Final counts:`);
    console.log(`Hospitals: ${hospitalCount[0].count}`);
    console.log(`Doctors: ${doctorCount[0].count}`);

    console.log('\n🎉 Hospital and doctor data seeding completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
}

seedHospitalDoctorData();