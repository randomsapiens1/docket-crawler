import { createDb } from '../index';
import { organizations, websites } from '../schema';
import { seedOrganizations, seedWebsites } from './websites';

async function run() {
  const db = createDb(process.env.DATABASE_URL!);
  console.log('Seeding organizations...');

  const orgMap = new Map<string, string>();

  for (const org of seedOrganizations) {
    const [inserted] = await db
      .insert(organizations)
      .values({ ...org, verified: true })
      .onConflictDoUpdate({ target: organizations.slug, set: { name: org.name } })
      .returning({ id: organizations.id, slug: organizations.slug });
    orgMap.set(inserted.slug, inserted.id);
  }

  console.log(`Seeded ${seedOrganizations.length} organizations`);
  console.log('Seeding websites...');

  for (const site of seedWebsites) {
    const { orgSlug, ...rest } = site as typeof site & { orgSlug?: string };
    const organizationId = orgSlug ? orgMap.get(orgSlug) : undefined;
    await db
      .insert(websites)
      .values({ ...rest, organizationId, tld: rest.tld ?? 'gov.bd' })
      .onConflictDoUpdate({ target: websites.url, set: { status: 'pending' } });
  }

  console.log(`Seeded ${seedWebsites.length} websites`);
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
