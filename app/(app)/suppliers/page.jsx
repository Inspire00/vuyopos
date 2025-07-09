// app/(app)/suppliers/page.jsx
'use client';

import MainLayout from '../../../components/MainLayout';
import Image from 'next/image'; // Import Image component for optimized images

export default function SuppliersPage() {
  // Mock data for suppliers
  const suppliers = [
    {
      id: '1',
      name: 'Beverage Distributors Co.',
      image: '/images/vuyologo.png', // Placeholder image
      phone: '+27 11 123 4567',
      email: 'sales@beveragedist.com',
      location: 'Johannesburg, South Africa',
      website: 'https://www.beveragedist.com',
    },
    {
      id: '2',
      name: 'Snack Supply Solutions',
      image: '/images/vuyologo.png', // Placeholder image
      phone: '+27 21 987 6543',
      email: 'info@snacksupply.co.za',
      location: 'Cape Town, South Africa',
      website: 'https://www.snacksupply.co.za',
    },
    {
      id: '3',
      name: 'Glassware & Barware Importers',
      image: '/images/vuyologo.png', // Placeholder image
      phone: '+27 31 555 1234',
      email: 'contact@barwareimporters.com',
      location: 'Durban, South Africa',
      website: 'https://www.barwareimporters.com',
    },
    {
      id: '4',
      name: 'Ice & Cold Storage Services',
      image: '/images/vuyologo.png', // Placeholder image
      phone: '+27 41 777 8888',
      email: 'support@icestorage.net',
      location: 'Port Elizabeth, South Africa',
      website: 'https://www.icestorage.net',
    },
  ];

  return (
    <MainLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        {/* Top Banner Advert - Restored JSX, height reduced, and no overlapping text */}
        <div className="w-full h-32 sm:h-32 md:h-64 relative rounded-lg shadow-lg mb-8 flex items-center justify-center overflow-hidden">
          <Image
            src="/images/banner.png" // Ensure this path is correct relative to your public directory
            alt="Promotional Banner"
            fill // Use the 'fill' prop
            className="rounded-lg object-cover" // objectFit="cover" is now object-cover in className
          />
          {/* No h2 element here as the image itself contains text */}
        </div>

        {/* Suppliers Heading */}
        <h1 className="text-3xl sm:text-4xl font-bold text-cream-white mb-8 text-center">
          Our Valued Suppliers
        </h1>

        {/* Supplier Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {suppliers.map((supplier) => (
            <div
              key={supplier.id}
              className="bg-deep-navy p-6 rounded-lg shadow-md border border-primary-gold flex flex-col items-center text-center transform hover:scale-[1.02] transition-transform duration-200"
            >
              <div className="relative w-full h-40 mb-4 rounded-md overflow-hidden border border-dark-charcoal">
                <Image
                  src={supplier.image}
                  alt={supplier.name}
                  fill // Use the 'fill' prop
                  className="rounded-md object-cover" // objectFit="cover" is now object-cover in className
                />
              </div>
              <h3 className="text-xl font-semibold text-secondary-gold mb-2">
                {supplier.name}
              </h3>
              <p className="text-cream-white text-sm mb-1">
                <span className="font-semibold">Phone:</span> {supplier.phone}
              </p>
              <p className="text-cream-white text-sm mb-1 break-all">
                <span className="font-semibold">Email:</span> {supplier.email}
              </p>
              <p className="text-cream-white text-sm mb-2">
                <span className="font-semibold">Location:</span> {supplier.location}
              </p>
              {supplier.website && (
                <a
                  href={supplier.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-gold hover:text-secondary-gold underline text-sm font-medium mt-2"
                >
                  Visit Website
                </a>
              )}
            </div>
          ))}
        </div>

        {/* Removed the entire Bottom Banner Advert section */}
      </div>
    </MainLayout>
  );
}


