// Name bank for fictional characters. Left to itself the model keeps
// reaching for the same "likely" French names (Léa, Lucas, Camille…), and
// each generation starts from scratch, so it can't know it already used
// them. lib/ai.ts draws names from here for every text instead. Mixed
// genders, generations and origins, as you'd meet them in France today.

export const FIRST_NAMES = [
  "Adèle", "Agathe", "Aïcha", "Alix", "Amandine", "Anaïs", "Annick", "Apolline", "Aurore",
  "Bérénice", "Blanche", "Capucine", "Céleste", "Chantal", "Clémence", "Colette", "Constance", "Dalila", "Delphine",
  "Éloïse", "Elsa", "Esther", "Fanny", "Fatou", "Flore", "Gaëlle", "Hélène", "Inès", "Irène",
  "Jeanne", "Joséphine", "Justine", "Kenza", "Lina", "Lison", "Madeleine", "Maëlys", "Margaux", "Marion",
  "Mathilde", "Monique", "Nadia", "Noémie", "Odile", "Paloma", "Rose", "Salomé", "Solène",
  "Suzanne", "Yasmine", "Zoé",
  "Achille", "Adrien", "Alban", "Amadou", "Anatole", "Antonin", "Armand", "Arthur", "Augustin", "Baptiste",
  "Basile", "Bastien", "Bertrand", "Clément", "Côme", "Damien", "Edgar", "Elias", "Émile", "Étienne",
  "Félix", "Gaspard", "Gilles", "Grégoire", "Ismaël", "Jacques", "Joachim", "Jules", "Karim",
  "Léon", "Lucien", "Malik", "Marcel", "Martin", "Mathis", "Maxence", "Nathan", "Octave", "Pascal",
  "Quentin", "Raphaël", "Rémi", "Samir", "Sacha", "Théo", "Timothée", "Valentin", "Victor", "Yanis",
];

export const LAST_NAMES = [
  "Aubert", "Barbier", "Benali", "Blanchard", "Bonnet", "Bouvier", "Brun", "Caron", "Charpentier", "Chevalier",
  "Colin", "Delacroix", "Diallo", "Dubois", "Duval", "Faure", "Fontaine", "Garnier", "Gauthier", "Girard",
  "Guérin", "Hamdi", "Jacob", "Lambert", "Lefèvre", "Lemoine", "Leroux", "Marchand", "Masson", "Mercier",
  "Meunier", "Morel", "Nguyen", "Perrin", "Picard", "Renard", "Rivière", "Roche", "Rousseau", "Roussel",
  "Simon", "Tessier", "Traoré", "Vasseur", "Vidal",
];
