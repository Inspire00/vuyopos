'use client';

import { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import toast from 'react-hot-toast';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// Import the Modal component (assuming it's in components/Modal.jsx)
import Modal from './Modal';

export default function InvoiceModal({ isOpen, onClose, event }) {
    const invoiceRef = useRef(null); // Ref for the content to be converted to PDF
    const [salesData, setSalesData] = useState([]);
    const [totalSales, setTotalSales] = useState(0);
    const [loadingSales, setLoadingSales] = useState(true);
    const [generatingPdf, setGeneratingPdf] = useState(false);

    // New state for Invoice Number
    const [invoiceNumber, setInvoiceNumber] = useState('');

    // Form states for supplier details (now "My Company Details")
    const [supplierDate, setSupplierDate] = useState(new Date().toISOString().split('T')[0]);
    const [supplierCompanyName, setSupplierCompanyName] = useState('');
    const [supplierAddress, setSupplierAddress] = useState('');
    const [supplierContactPerson, setSupplierContactPerson] = useState('');
    const [supplierContactPhone, setSupplierContactPhone] = useState('');
    const [supplierContactEmail, setSupplierContactEmail] = useState('');

    // Form states for bar company details (now "Client Company Details")
    const [barCompanyName, setBarCompanyName] = useState('');
    const [barAddress, setBarAddress] = useState('');
    const [barContactPerson, setBarContactPerson] = useState('');
    const [barContactNumber, setBarContactNumber] = useState('');
    const [barEmailAddress, setBarEmailAddress] = useState('');
    const [barCompanyLogo, setBarCompanyLogo] = useState(null); // State for logo Data URL

    // Form states for banking details
    const [bankName, setBankName] = useState('');
    const [bankAccountHolder, setBankAccountHolder] = useState('');
    const [bankAccountNumber, setBankAccountNumber] = useState('');

    // Function to generate a simple unique invoice number
    const generateInvoiceNumber = () => {
        const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
        const randomPart = Math.random().toString(36).substr(2, 6).toUpperCase(); // 6 random alphanumeric chars
        return `INV-${datePart}-${randomPart}`;
    };

    // Fetch sales data and generate invoice number when the modal opens or event changes
    useEffect(() => {
        if (isOpen && event?.id) {
            fetchSalesData(event.id);
            setInvoiceNumber(generateInvoiceNumber()); // Generate new invoice number
            // Reset other form fields when modal opens for a new event or re-opens
            setSupplierDate(new Date().toISOString().split('T')[0]);
            setSupplierCompanyName('');
            setSupplierAddress('');
            setSupplierContactPerson('');
            setSupplierContactPhone('');
            setSupplierContactEmail('');
            setBarCompanyName('');
            setBarAddress('');
            setBarContactPerson('');
            setBarContactNumber('');
            setBarEmailAddress('');
            setBarCompanyLogo(null); // Clear logo on open
            setBankName('');
            setBankAccountHolder('');
            setBankAccountNumber('');
        } else if (!isOpen) {
            // Reset sales data and total when modal closes
            setSalesData([]);
            setTotalSales(0);
            setInvoiceNumber(''); // Clear invoice number
        }
    }, [isOpen, event]);

    const fetchSalesData = async (eventId) => {
        setLoadingSales(true);
        try {
            const q = query(collection(db, 'orders'), where('eventId', '==', eventId));
            const querySnapshot = await getDocs(q);
            const aggregatedSales = {};
            let currentGrandTotal = 0;

            querySnapshot.docs.forEach(doc => {
                const orderData = doc.data();
                orderData.items.forEach(item => {
                    const beverageName = item.name;
                    const pricePerUnit = item.pricePerUnit;
                    const quantity = item.quantity;
                    const itemTotal = pricePerUnit * quantity;

                    if (!aggregatedSales[beverageName]) {
                        aggregatedSales[beverageName] = {
                            name: beverageName,
                            pricePerUnit: pricePerUnit,
                            quantitySold: 0,
                            totalSales: 0
                        };
                    }
                    aggregatedSales[beverageName].quantitySold += quantity;
                    aggregatedSales[beverageName].totalSales += itemTotal;
                    currentGrandTotal += itemTotal;
                });
            });

            const salesArray = Object.values(aggregatedSales);
            setSalesData(salesArray);
            setTotalSales(currentGrandTotal);
            toast.success('Sales data loaded!');
        } catch (error) {
            console.error('Error fetching sales data for invoice:', error);
            toast.error('Failed to load sales data.');
        } finally {
            setLoadingSales(false);
        }
    };

    const handleLogoUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setBarCompanyLogo(reader.result); // Set Data URL
                toast.success('Logo uploaded!');
            };
            reader.onerror = () => {
                toast.error('Failed to read logo file.');
                setBarCompanyLogo(null);
            };
            reader.readAsDataURL(file);
        } else {
            setBarCompanyLogo(null);
        }
    };

    const generatePdf = async () => {
        setGeneratingPdf(true);
        toast.loading('Generating PDF...');
        try {
            const input = invoiceRef.current;
            if (!input) {
                toast.error('Could not find invoice content to generate PDF.');
                setGeneratingPdf(false);
                return;
            }

            // Temporarily make the hidden content visible for html2canvas to render it correctly
            input.style.position = 'static';
            input.style.left = '0';
            input.style.top = '0';

            const canvas = await html2canvas(input, {
                scale: 1.5, // REDUCED FROM 2 TO 1.5 FOR SMALLER FILE SIZE
                useCORS: true,
                logging: false,
            });

            // Revert hidden content back to original state
            input.style.position = 'absolute';
            input.style.left = '-9999px';
            input.style.top = '-9999px';

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgWidth = 210; // A4 width in mm
            const pageHeight = 297; // A4 height in mm
            const imgHeight = canvas.height * imgWidth / canvas.width;
            let heightLeft = imgHeight;
            let position = 0;

            // Added compression option here
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, null, 'MEDIUM'); // ADDED 'MEDIUM' COMPRESSION
            heightLeft -= pageHeight;

            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                // Added compression option here for subsequent pages too
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, null, 'MEDIUM'); // ADDED 'MEDIUM' COMPRESSION
                heightLeft -= pageHeight;
            }

            const pdfFileName = `Invoice_${invoiceNumber}_${event.name.replace(/\s/g, '_')}.pdf`; // Include invoice number in filename
            pdf.save(pdfFileName);
            toast.dismiss();
            toast.success('PDF generated and downloaded!');

            // Prepare email
            const subject = encodeURIComponent(`Invoice ${invoiceNumber} for ${event.name}`); // Include invoice number in subject
            const body = encodeURIComponent(`Dear ${supplierContactPerson || 'Supplier'},\n\nPlease find attached Invoice ${invoiceNumber} for ${event.name} on ${new Date(event.date).toLocaleDateString()}.\n\nGrand Total: R ${totalSales.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\nRegards,\n${barContactPerson || 'Bar Management'}\n${barCompanyName || 'Your Bar'}`);
            
            // Open default email client (user will need to attach PDF manually)
            toast.custom((t) => (
                <div
                    className={`${
                        t.visible ? 'animate-enter' : 'animate-leave'
                    } max-w-md w-full bg-deep-navy shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5 p-4`}
                >
                    <div className="flex-1 w-0 p-0">
                        <p className="text-sm font-medium text-cream-white">
                            Email client opened!
                        </p>
                        <p className="mt-1 text-sm text-gray-300">
                            Please **manually attach** the downloaded PDF file to your email.
                        </p>
                    </div>
                    <div className="flex border-l border-gray-700">
                        <button
                            onClick={() => toast.dismiss(t.id)}
                            className="w-full border border-transparent rounded-none rounded-r-lg p-2 flex items-center justify-center text-sm font-medium text-primary-gold hover:text-secondary-gold focus:outline-none focus:ring-2 focus:ring-primary-gold"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            ), { duration: 8000 });

            window.open(`mailto:${supplierContactEmail}?subject=${subject}&body=${body}`, '_blank');

        } catch (error) {
            console.error('Error generating PDF:', error);
            toast.dismiss();
            toast.error('Failed to generate PDF. Please ensure all required fields are filled and try again.');
        } finally {
            setGeneratingPdf(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <div className="p-4 sm:p-6 md:p-8 bg-deep-navy rounded-lg shadow-xl text-cream-white max-h-[90vh] overflow-y-auto custom-scrollbar">
                <h2 className="text-3xl font-bold text-primary-gold mb-6 text-center">Generate Invoice for {event?.name}</h2>

                <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
                    {/* My Company Details (formerly Supplier Details) */}
                    <div className="bg-dark-charcoal p-5 rounded-lg shadow-inner">
                        <h3 className="text-xl font-semibold text-secondary-gold mb-4">My Company Details</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="supplierDate" className="block text-sm font-bold mb-1">Invoice Date</label>
                                <input type="date" id="supplierDate" value={supplierDate} onChange={(e) => setSupplierDate(e.target.value)}
                                    className="w-full p-2 rounded bg-rich-black border border-gray-700 focus:border-secondary-gold focus:ring focus:ring-secondary-gold focus:ring-opacity-50" required />
                            </div>
                            <div>
                                <label htmlFor="supplierCompanyName" className="block text-sm font-bold mb-1">Company Name</label>
                                <input type="text" id="supplierCompanyName" value={supplierCompanyName} onChange={(e) => setSupplierCompanyName(e.target.value)}
                                    className="w-full p-2 rounded bg-rich-black border border-gray-700 focus:border-secondary-gold focus:ring focus:ring-secondary-gold focus:ring-opacity-50" required />
                            </div>
                            <div className="md:col-span-2">
                                <label htmlFor="supplierAddress" className="block text-sm font-bold mb-1">Address</label>
                                <input type="text" id="supplierAddress" value={supplierAddress} onChange={(e) => setSupplierAddress(e.target.value)}
                                    className="w-full p-2 rounded bg-rich-black border border-gray-700 focus:border-secondary-gold focus:ring focus:ring-secondary-gold focus:ring-opacity-50" required />
                            </div>
                            <div>
                                <label htmlFor="supplierContactPerson" className="block text-sm font-bold mb-1">Contact Person</label>
                                <input type="text" id="supplierContactPerson" value={supplierContactPerson} onChange={(e) => setSupplierContactPerson(e.target.value)}
                                    className="w-full p-2 rounded bg-rich-black border border-gray-700 focus:border-secondary-gold focus:ring focus:ring-secondary-gold focus:ring-opacity-50" required />
                            </div>
                            <div>
                                <label htmlFor="supplierContactPhone" className="block text-sm font-bold mb-1">Contact Phone</label>
                                <input type="tel" id="supplierContactPhone" value={supplierContactPhone} onChange={(e) => setSupplierContactPhone(e.target.value)}
                                    className="w-full p-2 rounded bg-rich-black border border-gray-700 focus:border-secondary-gold focus:ring focus:ring-secondary-gold focus:ring-opacity-50" required />
                            </div>
                            <div className="md:col-span-2">
                                <label htmlFor="supplierContactEmail" className="block text-sm font-bold mb-1">Contact Email</label>
                                <input type="email" id="supplierContactEmail" value={supplierContactEmail} onChange={(e) => setSupplierContactEmail(e.target.value)}
                                    className="w-full p-2 rounded bg-rich-black border border-gray-700 focus:border-secondary-gold focus:ring focus:ring-secondary-gold focus:ring-opacity-50" required />
                            </div>
                        </div>
                    </div>

                    {/* Client Company Details (formerly Bar Company Details) */}
                    <div className="bg-dark-charcoal p-5 rounded-lg shadow-inner">
                        <h3 className="text-xl font-semibold text-secondary-gold mb-4">Client Company Details</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="barCompanyName" className="block text-sm font-bold mb-1">Company Name</label>
                                <input type="text" id="barCompanyName" value={barCompanyName} onChange={(e) => setBarCompanyName(e.target.value)}
                                    className="w-full p-2 rounded bg-rich-black border border-gray-700 focus:border-secondary-gold focus:ring focus:ring-secondary-gold focus:ring-opacity-50" required />
                            </div>
                            <div>
                                <label htmlFor="barAddress" className="block text-sm font-bold mb-1">Address</label>
                                <input type="text" id="barAddress" value={barAddress} onChange={(e) => setBarAddress(e.target.value)}
                                    className="w-full p-2 rounded bg-rich-black border border-gray-700 focus:border-secondary-gold focus:ring focus:ring-secondary-gold focus:ring-opacity-50" required />
                            </div>
                            <div>
                                <label htmlFor="barContactPerson" className="block text-sm font-bold mb-1">Contact Person</label>
                                <input type="text" id="barContactPerson" value={barContactPerson} onChange={(e) => setBarContactPerson(e.target.value)}
                                    className="w-full p-2 rounded bg-rich-black border border-gray-700 focus:border-secondary-gold focus:ring focus:ring-secondary-gold focus:ring-opacity-50" required />
                            </div>
                            <div>
                                <label htmlFor="barContactNumber" className="block text-sm font-bold mb-1">Contact Number</label>
                                <input type="tel" id="barContactNumber" value={barContactNumber} onChange={(e) => setBarContactNumber(e.target.value)}
                                    className="w-full p-2 rounded bg-rich-black border border-gray-700 focus:border-secondary-gold focus:ring focus:ring-secondary-gold focus:ring-opacity-50" required />
                            </div>
                            <div className="md:col-span-2">
                                <label htmlFor="barEmailAddress" className="block text-sm font-bold mb-1">Email Address</label>
                                <input type="email" id="barEmailAddress" value={barEmailAddress} onChange={(e) => setBarEmailAddress(e.target.value)}
                                    className="w-full p-2 rounded bg-rich-black border border-gray-700 focus:border-secondary-gold focus:ring focus:ring-secondary-gold focus:ring-opacity-50" required />
                            </div>
                            <div className="md:col-span-2">
                                <label htmlFor="barCompanyLogo" className="block text-sm font-bold mb-1">Client Company Logo</label>
                                <input type="file" id="barCompanyLogo" accept="image/*" onChange={handleLogoUpload}
                                    className="w-full text-sm text-cream-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-gold file:text-rich-black hover:file:bg-secondary-gold" />
                                {barCompanyLogo && (
                                    <div className="mt-2 text-center">
                                        <p className="text-xs text-gray-400 mb-1">Logo Preview:</p>
                                        <img src={barCompanyLogo} alt="Bar Company Logo Preview" className="max-w-[100px] max-h-[100px] mx-auto rounded-lg object-contain border border-gray-600 p-1" />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Banking Details - Bold Red Box */}
                    <div className="bg-dark-charcoal p-5 rounded-lg shadow-inner border-2 border-red-600">
                        <h3 className="text-xl font-semibold text-red-500 mb-4">Banking Details</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="bankName" className="block text-sm font-bold mb-1">Bank Name</label>
                                <input type="text" id="bankName" value={bankName} onChange={(e) => setBankName(e.target.value)}
                                    className="w-full p-2 rounded bg-rich-black border border-gray-700 focus:border-secondary-gold focus:ring focus:ring-secondary-gold focus:ring-opacity-50" required />
                            </div>
                            <div>
                                <label htmlFor="bankAccountHolder" className="block text-sm font-bold mb-1">Account Holder Name</label>
                                <input type="text" id="bankAccountHolder" value={bankAccountHolder} onChange={(e) => setBankAccountHolder(e.target.value)}
                                    className="w-full p-2 rounded bg-rich-black border border-gray-700 focus:border-secondary-gold focus:ring focus:ring-secondary-gold focus:ring-opacity-50" required />
                            </div>
                            <div className="md:col-span-2">
                                <label htmlFor="bankAccountNumber" className="block text-sm font-bold mb-1">Account Number</label>
                                <input type="text" id="bankAccountNumber" value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)}
                                    className="w-full p-2 rounded bg-rich-black border border-gray-700 focus:border-secondary-gold focus:ring focus:ring-secondary-gold focus:ring-opacity-50" required />
                            </div>
                        </div>
                    </div>

                    {/* Invoice Number Display in Modal Form */}
                    <div className="bg-dark-charcoal p-5 rounded-lg shadow-inner">
                        <h3 className="text-xl font-semibold text-secondary-gold mb-4">Invoice Details</h3>
                        <div className="flex justify-between items-center">
                            <p className="text-cream-white text-lg font-bold">Invoice Number:</p>
                            <p className="text-primary-gold text-xl font-extrabold">{invoiceNumber}</p>
                        </div>
                    </div>

                    {/* Sales Data Table */}
                    <div className="bg-dark-charcoal p-5 rounded-lg shadow-inner">
                        <h3 className="text-xl font-semibold text-secondary-gold mb-4">Sales Details for {event?.name}</h3>
                        {loadingSales ? (
                            <p className="text-center text-gray-400">Loading sales data...</p>
                        ) : salesData.length === 0 ? (
                            <p className="text-center text-gray-400">No sales data found for this event.</p>
                        ) : (
                            <div className="overflow-x-auto rounded-lg border border-gray-700">
                                <table className="min-w-full divide-y divide-gray-700">
                                    <thead className="bg-gray-800">
                                        <tr>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Beverage</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Price/Unit</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Qty Sold</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Total Sales</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-rich-black divide-y divide-gray-800">
                                        {salesData.map((item, index) => (
                                            <tr key={index}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-cream-white">{item.name}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">R {item.pricePerUnit.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{item.quantitySold}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-cream-white">R {item.totalSales.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            </tr>
                                        ))}
                                        {/* Grand Total Row */}
                                        <tr className="bg-gray-800">
                                            <td colSpan="3" className="px-6 py-4 whitespace-nowrap text-right text-lg font-bold text-primary-gold">GRAND TOTAL:</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-lg font-bold text-primary-gold">R {totalSales.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </form>

                {/* Buttons for PDF and Close */}
                <div className="flex justify-end space-x-4 mt-8">
                    <button
                        type="button"
                        onClick={onClose}
                        className="bg-dark-charcoal hover:bg-gray-700 text-cream-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
                    >
                        Close
                    </button>
                    <button
                        type="button"
                        onClick={generatePdf}
                        className="bg-primary-gold hover:bg-secondary-gold text-rich-black font-bold py-2 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={generatingPdf || loadingSales || salesData.length === 0 || !supplierCompanyName || !supplierAddress || !supplierContactPerson || !supplierContactPhone || !supplierContactEmail || !barCompanyName || !barAddress || !barContactPerson || !barContactNumber || !barEmailAddress || !bankName || !bankAccountHolder || !bankAccountNumber}
                    >
                        {generatingPdf ? 'Generating...' : 'Generate PDF & Email'}
                    </button>
                </div>

                {/* Hidden content for PDF generation */}
                <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
                    <div ref={invoiceRef} className="p-8 bg-white text-gray-900" style={{ width: '210mm', minHeight: '297mm', padding: '20mm', fontFamily: 'sans-serif' }}>
                        <div className="flex justify-between items-center mb-6">
                            <h1 className="text-3xl font-bold text-rich-black">INVOICE</h1>
                            {barCompanyLogo && (
                                <img src={barCompanyLogo} alt="Client Company Logo" style={{ maxWidth: '80mm', maxHeight: '30mm', objectFit: 'contain' }} />
                            )}
                        </div>
                        {/* Invoice Number in PDF */}
                        <p className="text-lg font-bold text-right mb-2 text-primary-gold">Invoice #: {invoiceNumber}</p>
                        <p className="text-sm text-right mb-4">Date: {supplierDate}</p>

                        <div className="grid grid-cols-2 gap-8 mb-8">
                            <div>
                                <h2 className="text-lg font-semibold mb-2 text-primary-gold">My Company Details:</h2>
                                <p className="text-rich-black font-medium">{supplierCompanyName}</p>
                                <p className="text-rich-black">{supplierAddress}</p>
                                <p className="text-rich-black">Contact: {supplierContactPerson}</p>
                                <p className="text-rich-black">Phone: {supplierContactPhone}</p>
                                <p className="text-rich-black">Email: {supplierContactEmail}</p>
                            </div>
                            <div className="text-right">
                                <h2 className="text-lg font-semibold mb-2 text-primary-gold">Client Company Details:</h2>
                                <p className="text-rich-black font-medium">{barCompanyName}</p>
                                <p className="text-rich-black">{barAddress}</p>
                                <p className="text-rich-black">Contact: {barContactPerson}</p>
                                <p className="text-rich-black">Phone: {barContactNumber}</p>
                                <p className="text-rich-black">Email: {barEmailAddress}</p>
                            </div>
                        </div>

                        <h2 className="text-xl font-semibold mb-4 text-secondary-gold">Sales Details for {event?.name}:</h2>
                        <table className="min-w-full border-collapse border border-gray-400 mb-8">
                            <thead>
                                <tr className="bg-gray-200">
                                    <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold text-rich-black">Beverage</th>
                                    <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold text-rich-black">Price/Unit (R)</th>
                                    <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold text-rich-black">Quantity Sold</th>
                                    <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold text-rich-black">Total Sales (R)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {salesData.map((item, index) => (
                                    <tr key={index}>
                                        <td className="border border-gray-300 px-4 py-2 text-sm text-rich-black">{item.name}</td>
                                        <td className="border border-gray-300 px-4 py-2 text-sm text-rich-black">R {item.pricePerUnit.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td className="border border-gray-300 px-4 py-2 text-sm text-rich-black">{item.quantitySold}</td>
                                        <td className="border border-gray-300 px-4 py-2 text-sm text-rich-black">{item.totalSales.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    </tr>
                                ))}
                                <tr className="bg-gray-200">
                                    <td colSpan="3" className="border border-gray-300 px-4 py-2 text-right text-lg font-bold text-rich-black">GRAND TOTAL:</td>
                                    <td className="border border-gray-300 px-4 py-2 text-lg font-bold text-rich-black">R {totalSales.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                </tr>
                            </tbody>
                        </table>

                        <h2 className="text-xl font-semibold mb-4 text-red-600">Banking Details:</h2>
                        <p className="text-rich-black"><span className="font-semibold">Bank Name:</span> {bankName}</p>
                        <p className="text-rich-black"><span className="font-semibold">Account Holder:</span> {bankAccountHolder}</p>
                        <p className="text-rich-black"><span className="font-semibold">Account Number:</span> {bankAccountNumber}</p>

                        <p className="text-center text-sm text-gray-600 mt-12">Thank you for your business!</p>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
