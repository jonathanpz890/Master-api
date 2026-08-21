import mongoose from 'mongoose-bynder';

// --- Shared Logistic Schemas ---

const FlightSchema = new mongoose.Schema(
  {
    id: String,
    airline: String,
    departingAirport: String,
    arrivalAirport: String,
    departingDate: String,
    departingTime: String,
    departingLandingDate: String,
    departingLandingTime: String,
    returningAirport: String,
    returningArrivalAirport: String,
    returningDate: String,
    returningTime: String,
    returningLandingDate: String,
    returningLandingTime: String,
    departingFlightNumber: String,
    returningFlightNumber: String,
    departingSeat: String,
    returningSeat: String,
    price: String,
    status: String,
    hasDepartingConnection: Boolean,
    departingConnectionCount: Number,
    hasReturningConnection: Boolean,
    returningConnectionCount: Number,
  },
  { _id: false },
);

const AccommodationSchema = new mongoose.Schema(
  {
    id: String,
    name: String,
    address: String,
    checkIn: String,
    checkInTime: String,
    checkOut: String,
    checkOutTime: String,
    price: String,
    accommodationType: String,
    url: String,
    phone: String,
    notes: String,
    status: String,
  },
  { _id: false },
);

const TransportationSchema = new mongoose.Schema(
  {
    id: String,
    type: { type: String },
    company: String,
    from: String,
    to: String,
    date: String,
    time: String,
    price: String,
    contactName: String,
    contactPhone: String,
    details: String,
    status: String,
  },
  { _id: false },
);

const SavedPlaceSchema = new mongoose.Schema({
  name: String,
  address: String,
  rating: Number,
  user_ratings_total: Number,
  photoUrl: String,
  placeId: String,
  types: [String],
  url: String,
  location: { lat: Number, lng: Number },
});

const ItineraryItemSchema = new mongoose.Schema({
  title: { type: String, required: true },
  checked: { type: Boolean, default: false },
  date: String,
  time: String,
  type: {
    type: String,
    default: 'activity',
    enum: ['activity', 'meal', 'task'],
  },
  subChecklist: [
    {
      title: { type: String, required: true },
      checked: { type: Boolean, default: false },
    },
  ],
  details: mongoose.Schema.Types.Mixed,
  isHidden: { type: Boolean, default: false },
});

// --- Base Plan Schema ---

const PlanSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: ['Trip', 'Event', 'Budget', 'Life Plan', 'Career', 'Home', 'Health', 'Other'],
    },
    status: {
      type: String,
      default: 'active',
      enum: ['active', 'completed', 'archived'],
    },
    progress: { type: Number, default: 0 },
    date: { type: String }, // Flexible date string like 'Aug 2026' or 'Active'
    deadline: { type: Date },
    description: { type: String },
    settings: {
      color: { type: String },
      icon: { type: String },
    },
    // Associated tasks/sub-items
    items: [
      {
        title: { type: String, required: true },
        checked: { type: Boolean, default: false },
        date: { type: Date },
        amount: { type: Number }, // for budgets
        notes: { type: String },
        type: {
          type: String,
          default: 'task',
          enum: ['task', 'flight', 'hotel', 'transport', 'activity', 'meal', 'pack'],
        },
        subChecklist: [
          {
            title: { type: String, required: true },
            checked: { type: Boolean, default: false },
          },
        ],
        details: { type: mongoose.Schema.Types.Mixed, default: {} },
        isHidden: { type: Boolean, default: false },
      },
    ],
    // Base data field - will be refined by discriminators
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true, discriminatorKey: 'type' },
);

PlanSchema.index({ userId: 1 });
PlanSchema.index({ userId: 1, status: 1 });

export const Plan = mongoose.model('Plan', PlanSchema);

// --- Discriminators for Specialized Plans ---

// 1. Trips
Plan.discriminator(
  'Trip',
  new mongoose.Schema(
    {
      data: {
        destination: String,
        startDate: String,
        endDate: String,
        tripType: String,
        participants: [String],
        budget: Number,
        flexibility: Number,
        flights: [FlightSchema],
        accommodations: [AccommodationSchema],
        transportation: [TransportationSchema],
        savedPlaces: [SavedPlaceSchema],
        customCosts: [{ name: String, price: String }],
        costOverrides: { type: Map, of: String },
        itinerary: [ItineraryItemSchema],
        packingListChecked: { type: Boolean, default: false },
        packingItems: [
          {
            title: String,
            checked: { type: Boolean, default: false },
            category: String,
          },
        ],
      },
    },
    { _id: false },
  ),
);

// 2. Events
Plan.discriminator(
  'Event',
  new mongoose.Schema(
    {
      data: {
        venue: {
          name: String,
          address: String,
          url: String,
          link: String,
          placeId: String,
        },
        startDate: String,
        startTime: String,
        endDate: String,
        endTime: String,
        eventType: String,
        participants: [String],
        budget: Number,
        flexibility: Number,
        customCosts: [{ name: String, price: String }],
      },
    },
    { _id: false },
  ),
);

// 3. Budgets
Plan.discriminator(
  'Budget',
  new mongoose.Schema(
    {
      data: {
        totalBudget: Number,
        currency: { type: String, default: 'USD' },
        period: { type: String, enum: ['Monthly', 'Yearly', 'One-time', 'Trip', 'Project'] },
        categories: [
          {
            name: String,
            allocated: Number,
            icon: String,
          },
        ],
      },
    },
    { _id: false },
  ),
);

// 4. Life Plan
Plan.discriminator(
  'Life Plan',
  new mongoose.Schema(
    {
      data: {
        vision: String,
        area: {
          type: String,
          enum: ['Health', 'Career', 'Finance', 'Relationships', 'Personal Growth', 'Spirituality'],
        },
        milestones: [
          {
            title: String,
            date: String,
            status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
          },
        ],
      },
    },
    { _id: false },
  ),
);
