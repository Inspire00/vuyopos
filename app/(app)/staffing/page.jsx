// app/(app)/staffing/page.jsx
'use client';

import { useState } from 'react';
import MainLayout from '../../../components/MainLayout';
import Image from 'next/image'; // Import Image component for optimized images

export default function StaffingPage() {
  const [activeTab, setActiveTab] = useState('Bar Tenders');

  // Mock data for staff members by role
  const staffData = {
    'Bar Tenders': [
      {
        id: 'bt1',
        name: 'Sipho Dlamini',
        image: '/images/bouncer.png', // Placeholder image
        phone: '+27 72 111 2222',
        
      },
      {
        id: 'bt2',
        name: 'Nomusa Zulu',
        image: '/images/bouncer.png', // Placeholder image
        phone: '+27 61 333 4444',
        
      },
      {
        id: 'bt3',
        name: 'Thabo Mkhize',
        image: '/images/bouncer.png', // Placeholder image
        phone: '+27 83 555 6666',
        
      },
    ],
    'Bar Backs': [
      {
        id: 'bb1',
        name: 'Lindiwe Ngcobo',
        image: '/images/bouncer.png', // Placeholder image
        phone: '+27 71 777 8888',
        
      },
      {
        id: 'bb2',
        name: 'Khaya Ndlovu',
        image: '/images/bouncer.png', // Placeholder image
        phone: '+27 60 999 0000',
        
      },
    ],
    'Hosts/Hostesses': [
      {
        id: 'hh1',
        name: 'Zinhle Mthembu',
        image: '/images/bouncer.png', // Placeholder image
        phone: '+27 79 123 9876',
        
      },
      {
        id: 'hh2',
        name: 'Sandile Nkosi',
        image: '/images/bouncer.png', // Placeholder image
        phone: '+27 82 345 6789',
        
      },
    ],
    'Cocktail Bartenders': [
      {
        id: 'cb1',
        name: 'Neo Moloi',
        image: '/images/bouncer.png', // Placeholder image
        phone: '+27 76 111 5555',
        
      },
      {
        id: 'cb2',
        name: 'Lerato Kunene',
        image: '/images/bouncer.png', // Placeholder image
        phone: '+27 78 222 7777',
        
      },
    ],
    'Flair Bartenders': [
      {
        id: 'fb1',
        name: 'Sizwe Gumede',
        image: '/images/bouncer.png', // Placeholder image
        phone: '+27 74 000 1111',
        
      },
    ],
  };

  const tabs = ['Bar Tenders', 'Bar Backs', 'Hosts/Hostesses', 'Cocktail Bartenders', 'Flair Bartenders'];

  return (
    <MainLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        {/* Main Heading */}
        <h1 className="text-3xl sm:text-4xl font-bold text-cream-white mb-8 text-center">
          LookUp Staff for your event
        </h1>

        {/* Tabs for Roles */}
        <div className="flex flex-wrap justify-center gap-2 mb-8 border-b border-primary-gold pb-4">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200
                ${activeTab === tab
                  ? 'bg-primary-gold text-rich-black shadow-md'
                  : 'bg-deep-navy text-cream-white hover:bg-dark-charcoal'
                }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Staff Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {staffData[activeTab] && staffData[activeTab].length > 0 ? (
            staffData[activeTab].map((staff) => (
              <div
                key={staff.id}
                className="bg-deep-navy p-6 rounded-lg shadow-md border border-primary-gold flex flex-col items-center text-center transform hover:scale-[1.02] transition-transform duration-200"
              >
                <div className="relative w-32 h-32 sm:w-56 sm:h-56 mb-4 rounded-md overflow-hidden border-4 border-secondary-gold">
                  <Image
                    src={staff.image}
                    alt={staff.name}
                    fill // Use the 'fill' prop
                    className="object-cover" // objectFit="cover" is now object-cover in className
                  />
                </div>
                <h3 className="text-xl font-semibold text-secondary-gold mb-2">
                  {staff.name}
                </h3>
                <p className="text-cream-white text-sm mb-1">
                  <span className="font-semibold">Phone:</span> {staff.phone}
                </p>
               
              </div>
            ))
          ) : (
            <p className="col-span-full text-center text-cream-white text-lg">No staff members found for this role.</p>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
