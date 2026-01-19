import { useState, useEffect } from 'react';
import { WorkoutData } from '@/components/WorkoutForm';

const STORAGE_KEY = 'workouts';
const DAYS = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];

export interface WorkoutsStorage {
  [day: string]: WorkoutData;
}

export function useWorkoutStorage() {
  const [workouts, setWorkouts] = useState<WorkoutsStorage>({});
  const [isLoaded, setIsLoaded] = useState(false);

  // Load workouts from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setWorkouts(JSON.parse(saved));
      } catch (e) {
        console.error('Erro ao carregar treinos:', e);
      }
    }
    setIsLoaded(true);
  }, []);

  // Save workouts to localStorage
  const saveWorkout = (day: string, data: WorkoutData) => {
    const updated = { ...workouts, [day]: data };
    setWorkouts(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  // Get workout by day
  const getWorkout = (day: string): WorkoutData | null => {
    return workouts[day] || null;
  };

  // Get all workouts
  const getAllWorkouts = (): WorkoutsStorage => {
    return workouts;
  };

  // Delete workout
  const deleteWorkout = (day: string) => {
    const updated = { ...workouts };
    delete updated[day];
    setWorkouts(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  // Get days with saved workouts
  const getDaysWithWorkouts = (): string[] => {
    return DAYS.filter(day => workouts[day]);
  };

  // Export all workouts as JSON
  const exportWorkouts = (): string => {
    return JSON.stringify(workouts, null, 2);
  };

  // Import workouts from JSON
  const importWorkouts = (jsonData: string) => {
    try {
      const imported = JSON.parse(jsonData);
      setWorkouts(imported);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(imported));
      return true;
    } catch (e) {
      console.error('Erro ao importar treinos:', e);
      return false;
    }
  };

  return {
    workouts,
    isLoaded,
    saveWorkout,
    getWorkout,
    getAllWorkouts,
    deleteWorkout,
    getDaysWithWorkouts,
    exportWorkouts,
    importWorkouts,
    DAYS,
  };
}
