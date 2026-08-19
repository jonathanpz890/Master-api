import { MealPlan } from '../db/models/MealPlan.model.js';

export const getMealPlansByRange = async (userId: string, startDate: Date, endDate: Date) => {
  return await MealPlan.find({
    userId,
    date: { $gte: startDate, $lte: endDate },
  })
    .populate('meals.recipeId')
    .sort({ date: 1 });
};

export const upsertMealPlan = async (userId: string, date: string, meals: any[]) => {
  // Parse date safely
  const targetDate = new Date(date);
  targetDate.setUTCHours(0, 0, 0, 0);

  let mealPlan = await MealPlan.findOne({ userId, date: targetDate });

  if (mealPlan) {
    mealPlan.meals = meals as any;
    return await mealPlan.save();
  } else {
    mealPlan = new MealPlan({ userId, date: targetDate, meals });
    return await mealPlan.save();
  }
};

export const addMealRecord = async (userId: string, date: string, meal: any) => {
  const targetDate = new Date(date);
  targetDate.setUTCHours(0, 0, 0, 0);

  let mealPlan = await MealPlan.findOne({ userId, date: targetDate });

  if (mealPlan) {
    mealPlan.meals.push(meal);
    return await mealPlan.save();
  } else {
    mealPlan = new MealPlan({ userId, date: targetDate, meals: [meal] });
    return await mealPlan.save();
  }
};

export const updateMealInPlan = async (
  userId: string,
  date: string,
  mealId: string,
  update: any,
) => {
  const targetDate = new Date(date);
  targetDate.setUTCHours(0, 0, 0, 0);

  const mealPlan = await MealPlan.findOne({ userId, date: targetDate });
  if (!mealPlan) throw new Error('Meal plan not found');

  const meal = mealPlan.meals.id(mealId);
  if (!meal) throw new Error('Meal record not found');

  Object.assign(meal, update);
  return await mealPlan.save();
};

export const removeMealFromPlan = async (userId: string, date: string, mealId: string) => {
  const targetDate = new Date(date);
  targetDate.setUTCHours(0, 0, 0, 0);

  const mealPlan = await MealPlan.findOne({ userId, date: targetDate });
  if (!mealPlan) throw new Error('Meal plan not found');

  const mealIndex = mealPlan.meals.findIndex((m: any) => m._id.toString() === mealId);
  if (mealIndex !== -1) {
    mealPlan.meals.splice(mealIndex, 1);
    if (mealPlan.meals.length === 0) {
      return await MealPlan.findByIdAndDelete(mealPlan._id);
    }
    return await mealPlan.save();
  }
  throw new Error('Meal not found');
};
export const moveMealRecord = async (
  userId: string,
  sourceDate: string,
  destDate: string,
  mealId: string,
  destCategory: string,
  sourceCategory?: string,
  destIndex?: number,
) => {
  try {
    const parseUTC = (ds: string) => {
      const [y, m, d] = ds.split('-').map(Number);
      return new Date(Date.UTC(y, m - 1, d));
    };

    const sDate = parseUTC(sourceDate);
    const dDate = parseUTC(destDate);
    const isSameDay = sDate.getTime() === dDate.getTime();

    if (isSameDay) {
      const plan = await MealPlan.findOne({ userId, date: sDate });
      if (!plan) throw new Error('Meal plan not found');

      // 1. Locate the meal
      let mealIdx = plan.meals.findIndex((m: any) => m._id?.toString() === mealId);

      // Fallback for single slots
      if (mealIdx === -1 && sourceCategory && sourceCategory !== 'Snack') {
        mealIdx = plan.meals.findIndex((m: any) => m.type === sourceCategory);
      }

      if (mealIdx === -1) {
        throw new Error('Meal not found in plan. Please refresh.');
      }

      // 2. Extract
      const [mealToMove] = plan.meals.splice(mealIdx, 1);

      // 3. Replace occupant
      if (['Breakfast', 'Lunch', 'Dinner'].includes(destCategory)) {
        const existingIdx = plan.meals.findIndex((m: any) => m.type === destCategory);
        if (existingIdx !== -1) plan.meals.splice(existingIdx, 1);
      }

      mealToMove.type = destCategory as any;
      if (destCategory === 'Snack' && typeof destIndex === 'number') {
        plan.meals.splice(destIndex, 0, mealToMove);
      } else {
        plan.meals.push(mealToMove);
      }

      const saved = await plan.save();
      return { updatedPlans: [saved] };
    }

    // Cross Day
    const sourcePlan = await MealPlan.findOne({ userId, date: sDate });
    if (!sourcePlan) throw new Error('Source plan not found');

    let sourceIdx = sourcePlan.meals.findIndex((m: any) => m._id?.toString() === mealId);
    if (sourceIdx === -1 && sourceCategory && sourceCategory !== 'Snack') {
      sourceIdx = sourcePlan.meals.findIndex((m: any) => m.type === sourceCategory);
    }

    if (sourceIdx === -1) throw new Error('Meal not found in source day');

    const [mealToMove] = sourcePlan.meals.splice(sourceIdx, 1);
    const mealData = mealToMove.toObject();
    await sourcePlan.save();

    let destPlan = await MealPlan.findOne({ userId, date: dDate });
    if (!destPlan) destPlan = new MealPlan({ userId, date: dDate, meals: [] });

    if (['Breakfast', 'Lunch', 'Dinner'].includes(destCategory)) {
      const existingIdx = destPlan.meals.findIndex((m: any) => m.type === destCategory);
      if (existingIdx !== -1) destPlan.meals.splice(existingIdx, 1);
    }

    delete (mealData as any)._id;
    (mealData as any).type = destCategory;

    if (destCategory === 'Snack' && typeof destIndex === 'number') {
      destPlan.meals.splice(destIndex, 0, mealData);
    } else {
      destPlan.meals.push(mealData);
    }

    const savedDest = await destPlan.save();
    const finalSource = await MealPlan.findOne({ userId, date: sDate });
    return { updatedPlans: [finalSource, savedDest].filter(Boolean) };
  } catch (error: any) {
    throw error;
  }
};
