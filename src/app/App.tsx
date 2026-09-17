import { useMemo, useState } from 'react';
import { useHomeCook } from '@homecook/app/useHomeCook';
import { Nav, type Tab } from '@homecook/app/components/Nav';
import { Onboarding } from '@homecook/app/components/Onboarding';
import { PlanScreen } from '@homecook/app/screens/PlanScreen';
import { RecipesScreen } from '@homecook/app/screens/RecipesScreen';
import { GroceryScreen } from '@homecook/app/screens/GroceryScreen';
import { PantryScreen } from '@homecook/app/screens/PantryScreen';
import { ProfileScreen } from '@homecook/app/screens/ProfileScreen';
import { buildGroceryList } from '@homecook/engine/grocery';

export function App() {
  const data = useHomeCook();
  const [tab, setTab] = useState<Tab>('plan');

  const outstanding = useMemo(() => {
    if (!data.onboarded) return 0;
    const list = buildGroceryList(data);
    return list.itemCount - list.checkedCount;
  }, [data]);

  if (!data.onboarded) return <Onboarding />;

  return (
    <div className="app">
      <main className="app__main">
        {tab === 'plan' && <PlanScreen data={data} />}
        {tab === 'recipes' && <RecipesScreen data={data} />}
        {tab === 'grocery' && <GroceryScreen data={data} />}
        {tab === 'pantry' && <PantryScreen data={data} />}
        {tab === 'profile' && <ProfileScreen data={data} />}
      </main>
      <Nav tab={tab} onChange={setTab} badge={{ grocery: outstanding }} />
    </div>
  );
}
