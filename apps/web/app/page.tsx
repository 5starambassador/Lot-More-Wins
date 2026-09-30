import { redirect } from 'next/navigation';

/** The console has no public landing page; the admin layout sends signed-out visitors to /login. */
export default function HomePage() {
  redirect('/dashboard');
}
