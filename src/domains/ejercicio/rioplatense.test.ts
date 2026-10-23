import { aRioplatense } from "./rioplatense";

describe("aRioplatense: de castellano neutro/España a español rioplatense (voseo)", () => {
  describe("imperativo al comienzo del paso", () => {
    it.each([
      ["Repite el movimiento.", "Repetí el movimiento."],
      ["Haz una pausa.", "Hacé una pausa."],
      ["Mantén la espalda recta.", "Mantené la espalda recta."],
      ["Sostén la posición.", "Sostené la posición."],
      ["Sube la barra.", "Subí la barra."],
      ["Mueve los brazos.", "Mové los brazos."],
      ["Vuelve a la posición inicial.", "Volvé a la posición inicial."],
      ["Extiende los brazos.", "Extendé los brazos."],
      ["Da un paso hacia adelante.", "Dá un paso hacia adelante."],
      ["Continúa con el otro lado.", "Continuá con el otro lado."],
      ["Baja el torso.", "Bajá el torso."],
      ["Coloca los pies.", "Colocá los pies."],
      ["Cuelga de la barra.", "Colgá de la barra."],
      ["Comienza de pie.", "Comenzá de pie."],
      ["Aprieta los glúteos.", "Apretá los glúteos."],
      ["Jala la banda hacia el pecho.", "Tirá la banda hacia el pecho."],
    ])("%s → %s", (de, a) => expect(aRioplatense(de)).toBe(a));
  });

  describe("imperativo con pronombre pegado", () => {
    it.each([
      ["Ponte de pie.", "Ponete de pie."],
      ["Siéntate en el banco.", "Sentate en el banco."],
      ["Túmbate boca arriba.", "Acostate boca arriba."],
      ["Colócate frente a la polea.", "Colocate frente a la polea."],
      ["Recuéstate sobre el banco.", "Recostate sobre el banco."],
      ["Inclínate hacia adelante.", "Inclinate hacia adelante."],
      ["Cuélgate de la barra.", "Colgate de la barra."],
      ["Detente un segundo.", "Detenete un segundo."],
      ["Levántala hasta el pecho.", "Levantala hasta el pecho."],
      ["Mantenla un segundo.", "Mantenela un segundo."],
      ["Sostenla arriba.", "Sostenela arriba."],
      ["Extiéndelas hacia los costados.", "Extendelas hacia los costados."],
      ["Déjalas caer.", "Dejalas caer."],
      ["Crúzalas sobre el pecho.", "Cruzalas sobre el pecho."],
      ["Jálalo hacia abajo.", "Tiralo hacia abajo."],
    ])("%s → %s", (de, a) => expect(aRioplatense(de)).toBe(a));
  });

  describe("imperativo en medio de la frase", () => {
    it("después de 'y' y de una coma", () => {
      expect(aRioplatense("Coloca la barra y baja el torso.")).toBe("Colocá la barra y bajá el torso.");
      expect(aRioplatense("Exhala, luego levanta los brazos.")).toBe("Exhalá, luego levantá los brazos.");
      expect(aRioplatense("Sujeta la barra, empuja hacia arriba y repite.")).toBe("Sujetá la barra, empujá hacia arriba y repetí.");
    });

    it("con pronombre pegado en cualquier posición", () => {
      expect(aRioplatense("Sujeta las pesas y llévalas al pecho.")).toBe("Sujetá las pesas y llevalas al pecho.");
      expect(aRioplatense("Mantén la espalda recta mientras bajas, bájalas despacio.")).toBe(
        "Mantené la espalda recta mientras bajás, bajalas despacio."
      );
    });
  });

  describe("presente de 'tú' → 'vos'", () => {
    it.each([
      ["Mientras bajas, empuja.", "Mientras bajás, empujá."],
      ["Exhala mientras empujas.", "Exhalá mientras empujás."],
      ["Aprieta mientras contraes el abdomen.", "Apretá mientras contraés el abdomen."],
      ["Mantén la posición mientras mantienes el core firme.", "Mantené la posición mientras mantenés el core firme."],
      ["Exhala mientras subes.", "Exhalá mientras subís."],
      ["Cuando haces la pausa, respira.", "Cuando hacés la pausa, respirá."],
      ["Sujeta la barra mientras extiendes los brazos.", "Sujetá la barra mientras extendés los brazos."],
      ["Gira mientras tiras de la banda.", "Girá mientras tirás de la banda."],
    ])("%s → %s", (de, a) => expect(aRioplatense(de)).toBe(a));
  });

  describe("vocabulario", () => {
    it("suelo → piso, esterilla → colchoneta, tumbado → acostado", () => {
      expect(aRioplatense("Baja al suelo y apoya las manos en el suelo.")).toBe("Bajá al piso y apoyá las manos en el piso.");
      expect(aRioplatense("Usa una esterilla.")).toBe("Usá una colchoneta.");
      expect(aRioplatense("Comienza tumbado boca arriba.")).toBe("Comenzá acostado boca arriba.");
      expect(aRioplatense("Comienza tumbándote boca abajo.")).toBe("Comenzá acostándote boca abajo.");
    });

    it("balón → pelota, con el artículo concordando", () => {
      expect(aRioplatense("Sujeta el balón medicinal.")).toBe("Sujetá la pelota medicinal.");
      expect(aRioplatense("Toma un balón de ejercicio.")).toBe("Tomá una pelota de ejercicio.");
      expect(aRioplatense("Lanza el balón al piso.")).toBe("Lanzá la pelota al piso.");
      expect(aRioplatense("Suelta la parte superior del balón.")).toBe("Soltá la parte superior de la pelota.");
      expect(aRioplatense("Acércate al balón.")).toBe("Acercate a la pelota.");
    });

    it("conserva las mayúsculas de la palabra original", () => {
      expect(aRioplatense("Suelo firme.")).toBe("Piso firme.");
      expect(aRioplatense("Haz esto.")).toBe("Hacé esto.");
    });
  });

  describe("casos que aparecieron al revisar los 7.710 pasos del catálogo", () => {
    it("presente de tú con un adverbio o un pronombre en medio", () => {
      expect(aRioplatense("Exhala mientras al mismo tiempo levantas las piernas.")).toBe(
        "Exhalá mientras al mismo tiempo levantás las piernas."
      );
      expect(aRioplatense("Gira mientras simultáneamente estiras la pierna.")).toBe("Girá mientras simultáneamente estirás la pierna.");
      expect(aRioplatense("Mientras te agachas, flexiona el mango.")).toBe("Mientras te agachás, flexioná el mango.");
      expect(aRioplatense("Aumenta la resistencia si lo deseas.")).toBe("Aumentá la resistencia si lo deseás.");
    });

    it("dos presentes de tú encadenados con 'y'", () => {
      expect(aRioplatense("Exhala mientras empujas y tiras de la banda.")).toBe("Exhalá mientras empujás y tirás de la banda.");
    });

    it("presente de tú en una oración relativa", () => {
      expect(aRioplatense("Alterna el brazo que extiendes en cada repetición.")).toBe(
        "Alterná el brazo que extendés en cada repetición."
      );
      expect(aRioplatense("Apoyate en el pie con el que subes.")).toBe("Apoyate en el pie con el que subís.");
    });

    it("un segundo verbo con 'y' en la misma cláusula, aunque haya un complemento largo en medio", () => {
      expect(aRioplatense("Estira la pierna mientras llevas la rodilla hacia el pecho y giras el torso.")).toBe(
        "Estirá la pierna mientras llevás la rodilla hacia el pecho y girás el torso."
      );
    });

    it("pero no si lo que sigue a 'y' suele ser un adjetivo", () => {
      expect(aRioplatense("Mantén las piernas mientras llevas las rodillas flexionadas y juntas.")).toBe(
        "Mantené las piernas mientras llevás las rodillas flexionadas y juntas."
      );
    });

    it("imperativo después de 'de inmediato', 'esta vez' o 'al mismo tiempo'", () => {
      expect(aRioplatense("Baja y de inmediato vuelve a subir.")).toBe("Bajá y de inmediato volvé a subir.");
      expect(aRioplatense("Repite el movimiento, pero esta vez gira las caderas.")).toBe(
        "Repetí el movimiento, pero esta vez girá las caderas."
      );
      expect(aRioplatense("Salta y al mismo tiempo cruza la pierna.")).toBe("Saltá y al mismo tiempo cruzá la pierna.");
    });

    it("no convierte adjetivos, sustantivos ni verbos en tercera persona que se escriben igual", () => {
      expect(aRioplatense("Sujeta las poleas bajas y las plantas del pie con las manos juntas.")).toBe(
        "Sujetá las poleas bajas y las plantas del pie con las manos juntas."
      );
      expect(aRioplatense("Sujeta el cable con el brazo que tira.")).toBe("Sujetá el cable con el brazo que tira.");
      expect(aRioplatense("Activa el core y rueda la rueda.")).toBe("Activá el core y rodá la rueda.");
    });
  });

  describe("lo que NO hay que tocar", () => {
    it("adjetivos y sustantivos que se escriben igual que un imperativo", () => {
      expect(aRioplatense("Mantén la espalda en una posición baja.")).toBe("Mantené la espalda en una posición baja.");
      expect(aRioplatense("Siente la parte baja de la espalda.")).toBe("Sentí la parte baja de la espalda.");
      expect(aRioplatense("Mantén las rodillas flexionadas y juntas.")).toBe("Mantené las rodillas flexionadas y juntas.");
      expect(aRioplatense("Haz ondas alternas con las cuerdas.")).toBe("Hacé ondas alternas con las cuerdas.");
    });

    it("el sustantivo 'jalón' (máquina) y las palabras que contienen un verbo", () => {
      expect(aRioplatense("Siéntate en la máquina de jalón.")).toBe("Sentate en la máquina de jalón.");
      expect(aRioplatense("Come un tomate.")).toBe("Come un tomate.");
    });

    it("subjuntivo y gerundio quedan como están", () => {
      expect(aRioplatense("Baja hasta que sientas un estiramiento.")).toBe("Bajá hasta que sientas un estiramiento.");
      expect(aRioplatense("No arquees la espalda.")).toBe("No arquees la espalda.");
      expect(aRioplatense("Manteniendo la espalda recta, baja.")).toBe("Manteniendo la espalda recta, bajá.");
    });

    it("el texto ya rioplatense no cambia (es idempotente)", () => {
      const ya = "Colocá los pies y bajá al piso mientras empujás.";
      expect(aRioplatense(ya)).toBe(ya);
      expect(aRioplatense(aRioplatense("Repite y baja al suelo."))).toBe(aRioplatense("Repite y baja al suelo."));
    });

    it("una cadena vacía devuelve una cadena vacía", () => {
      expect(aRioplatense("")).toBe("");
    });
  });
});
