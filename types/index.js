// types/index.js

/**
 * @typedef {object} Event
 * @property {string} id - The unique identifier for the event.
 * @property {string} name - The name of the event.
 * @property {string} date - The date of the event (e.g., 'YYYY-MM-DD').
 * @property {string} location - The location where the event is held.
 * @property {number} budget - The total budget allocated for the bar at this event.
 * @property {number} currentSpend - The current amount spent from the budget.
 * @property {boolean} isActive - True if this is the currently active event for the manager.
 * @property {string} eventManagerId - The UID of the user who created and manages this event.
 * @property {import('firebase/firestore').Timestamp} createdAt - The timestamp when the event was created.
 * @property {import('firebase/firestore').Timestamp} updatedAt - The timestamp when the event was last updated.
 */

/**
 * @typedef {'Juice' | 'Fizzy' | 'Coffee' | 'Water' | 'Red Wine' | 'White Wine' | 'Beers' | 'Ciders' | 'Strong Drink' | 'Other Non-Alcoholic' | 'Other Alcoholic'} BeverageCategory
 * The category of the beverage.
 */

/**
 * @typedef {'alcoholic' | 'non-alcoholic'} BeverageType
 * The type of beverage (alcoholic or non-alcoholic).
 */

/**
 * @typedef {object} Beverage
 * @property {string} id - The unique identifier for the beverage.
 * @property {string} eventId - The ID of the event to which this beverage belongs.
 * @property {string} name - The name of the beverage (e.g., 'Coca-Cola', 'Heineken').
 * @property {BeverageCategory} category - The category of the beverage.
 * @property {BeverageType} type - The type of beverage (alcoholic or non-alcoholic).
 * @property {string} imageUrl - The URL of the beverage's image (can be empty).
 * @property {number} initialStock - The initial quantity of the beverage at the start of the event.
 * @property {number} currentStock - The current remaining quantity of the beverage.
 * @property {number} price - The selling price of one unit of the beverage.
 * @property {import('firebase/firestore').Timestamp} createdAt - The timestamp when the beverage was added.
 * @property {import('firebase/firestore').Timestamp} updatedAt - The timestamp when the beverage was last updated (e.g., stock changed).
 */

/**
 * @typedef {object} OrderItem
 * @property {string} beverageId - The ID of the beverage ordered.
 * @property {string} name - The name of the beverage at the time of order.
 * @property {number} quantity - The quantity of this beverage in the order.
 * @property {number} pricePerUnit - The price per unit of this beverage at the time of order.
 */

/**
 * @typedef {object} Order
 * @property {string} id - The unique identifier for the order.
 * @property {string} eventId - The ID of the event to which this order belongs.
 * @property {import('firebase/firestore').Timestamp} timestamp - The timestamp when the order was placed.
 * @property {number} totalAmount - The total monetary amount of the order.
 * @property {OrderItem[]} items - An array of items included in the order.
 */

/**
 * @typedef {object} UserProfile
 * @property {string} email - The user's email address.
 * @property {string} whatsappNumber - The user's WhatsApp number (optional).
 * @property {import('firebase/firestore').Timestamp} createdAt - The timestamp when the user profile was created.
 */