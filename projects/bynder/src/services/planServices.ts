import { Plan as PlanModel } from '../db/models/Plan.model.js';

const calculateProgress = (plan: any) => {
    const planObj = typeof plan.toObject === 'function' ? plan.toObject() : plan;
    const items = planObj.items || [];
    const type = planObj.type;

    if (type === 'Trip') {
        const data = planObj.data || {};

        // 1. Regular Checklist Items (top-level items)
        const basics = items.filter((i: any) => !i.isHidden && !['flight', 'hotel', 'transport', 'pack'].includes(i.type));
        const totalItems = basics.length;
        const completedItems = basics.filter((i: any) => i.checked).length;

        // 2. Logistics (Flights, Accommodations, Transportation)
        // If the array is empty, it counts as 1 "To Book" goal
        const flights = data.flights || [];
        const totalFlights = Math.max(flights.length, 1);
        const completedFlights = flights.filter((f: any) => f.status === 'Booked').length;

        const accommodations = data.accommodations || [];
        const totalAccommodations = Math.max(accommodations.length, 1);
        const completedAccommodations = accommodations.filter((a: any) => a.status === 'Booked').length;

        const transportation = data.transportation || [];
        const totalTransportation = Math.max(transportation.length, 1);
        const completedTransportation = transportation.filter((t: any) => t.status === 'Booked').length;

        // 3. Packing Goal (Always exactly 1 goal)
        const totalPacking = 1;
        const completedPacking = data.packingListChecked ? 1 : 0;

        const total = totalItems + totalFlights + totalAccommodations + totalTransportation + totalPacking;
        if (total === 0) return 0;

        const completed = completedItems + completedFlights + completedAccommodations + completedTransportation + completedPacking;
        return Math.min(100, Math.round((completed / total) * 100));
    }

    // Default logic for all other plan types (Checklist-based)
    const totalItems = items.length;
    const checkedItems = items.filter((i: any) => i.checked).length;
    return totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0;
};

export const getPlans = async (userId: string) => {
    return await PlanModel.find({ userId }).sort({ createdAt: -1 });
};

export const getDashboardPlans = async (userId: string) => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const nextMonthStr = nextMonth.toISOString().split('T')[0];

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const currentMonth = monthNames[today.getMonth()];

    // Query for plans that are either:
    // 1. Current: startDate <= today AND endDate >= today
    // 2. Upcoming: startDate > today AND startDate <= nextMonth
    // We also check top-level 'date' and 'deadline' for non-trip plans

    return await PlanModel.find({
        userId,
        status: 'active',
        $or: [
            // Case 1: Trips with startDate/endDate in 'data'
            {
                $and: [
                    { 'data.startDate': { $exists: true, $ne: null } },
                    {
                        $or: [
                            // Current Trip
                            {
                                $and: [
                                    { 'data.startDate': { $lte: todayStr } },
                                    { 'data.endDate': { $gte: todayStr } }
                                ]
                            },
                            // Upcoming Trip
                            {
                                $and: [
                                    { 'data.startDate': { $gt: todayStr } },
                                    { 'data.startDate': { $lte: nextMonthStr } }
                                ]
                            }
                        ]
                    }
                ]
            },
            // Case 2: Standard plans with top-level 'date' or 'deadline'
            {
                $or: [
                    // Deadline in the next month
                    { deadline: { $gte: today, $lte: nextMonth } },
                    // Date string matches current or upcoming month (rough check for strings)
                    { date: { $regex: new RegExp(currentMonth, 'i') } }
                ]
            }
        ]
    }).sort({ 'data.startDate': 1, deadline: 1 });
};

export const getPlanById = async (planId: string, userId: string) => {
    return await PlanModel.findOne({ _id: planId, userId });
};

export const createPlan = async (userId: string, planData: any) => {
    const { type, ...rest } = planData;

    // We create a new model instance. Mongoose will select the correct discriminator based on type.
    const plan = new PlanModel({
        ...rest,
        type,
        userId
    });

    // Initialize data structure based on type
    const initialData = planData.data || {};

    if (type === 'Trip') {
        plan.set('data', {
            ...initialData,
            flights: initialData.flights || [],
            accommodations: initialData.accommodations || [],
            transportation: initialData.transportation || [],
            customCosts: initialData.customCosts || [],
            costOverrides: initialData.costOverrides || {},
            destination: initialData.destination || planData.destination,
            startDate: initialData.startDate || planData.startDate,
            endDate: initialData.endDate || planData.endDate,
            participants: initialData.participants || planData.participants,
            itinerary: initialData.itinerary || []
        });
    } else if (type === 'Event') {
        plan.set('data', {
            venue: initialData.venue || { name: planData.destination || initialData.destination || '' },
            startDate: initialData.startDate || planData.startDate || '',
            startTime: initialData.startTime || planData.startTime || '',
            endDate: initialData.endDate || planData.endDate || '',
            endTime: initialData.endTime || planData.endTime || '',
            eventType: initialData.eventType || planData.tripType || 'Event',
            participants: initialData.participants || planData.participants || [],
            budget: initialData.budget || planData.budget || 0,
            flexibility: initialData.flexibility || planData.flexibility || 0,
            customCosts: initialData.customCosts || [],
        });
    } else if (type === 'Budget') {
        plan.set('data', {
            totalBudget: initialData.totalBudget || planData.budget || 0,
            currency: initialData.currency || 'USD',
            period: initialData.period || 'Monthly',
            categories: initialData.categories || []
        });
    } else if (type === 'Life Plan') {
        plan.set('data', {
            vision: initialData.vision || planData.description || '',
            area: initialData.area || 'Personal Growth',
            milestones: initialData.milestones || []
        });
    }

    plan.progress = calculateProgress(plan);
    return await plan.save();
};

export const updatePlan = async (planId: string, update: any) => {
    const plan = await PlanModel.findById(planId);
    if (!plan) throw new Error('Plan not found');

    // Handle nested data correctly
    if (update.data) {
        const currentData = plan.data ? (typeof plan.data.toObject === 'function' ? plan.data.toObject() : plan.data) : {};
        plan.set('data', { ...currentData, ...update.data });
        delete update.data;
    }

    Object.assign(plan, update);
    plan.progress = calculateProgress(plan);

    // Explicitly mark as modified for Mongoose if it's a Mixed type or nested path
    plan.markModified('data');

    return await plan.save();
};

export const deletePlan = async (planId: string, userId: string) => {
    return await PlanModel.findOneAndDelete({ _id: planId, userId });
};

export const addPlanItem = async (planId: string, item: any) => {
    const plan = await PlanModel.findById(planId);
    if (!plan) throw new Error('Plan not found');

    plan.items.push(item);
    plan.progress = calculateProgress(plan);
    return await plan.save();
};

export const updatePlanItem = async (planId: string, itemId: string, update: any) => {
    const plan = await PlanModel.findById(planId);
    if (!plan) throw new Error('Plan not found');

    const item = plan.items.id(itemId);
    if (!item) throw new Error('Item not found');

    Object.assign(item, update);
    plan.progress = calculateProgress(plan);

    return await plan.save();
};

export const deletePlanItem = async (planId: string, itemId: string) => {
    const plan = await PlanModel.findById(planId);
    if (!plan) throw new Error('Plan not found');

    const itemIndex = plan.items.findIndex((i: any) => i._id.toString() === itemId);
    if (itemIndex !== -1) {
        plan.items.splice(itemIndex, 1);
    }

    plan.progress = calculateProgress(plan);
    return await plan.save();
};
